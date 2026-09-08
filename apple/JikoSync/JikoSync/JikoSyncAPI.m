//
//  JikoSyncAPI.m
//  JikoSync
//
//  Created by Hadi Ahmad on 11/2/25.
//

#import "JikoSyncAPI.h"
#import <Foundation/Foundation.h>

@interface JikoSyncAPI ()
@property (nonatomic, strong) NSString *baseURL;
@property (nonatomic, strong) NSString *authToken;
@property (nonatomic, strong) NSString *refreshToken;
@property (nonatomic, strong) NSURLSession *session;
@end

@implementation JikoSyncAPI

+ (instancetype)sharedAPI {
    static JikoSyncAPI *sharedInstance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[JikoSyncAPI alloc] init];
    });
    return sharedInstance;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        NSURLSessionConfiguration *config = [NSURLSessionConfiguration defaultSessionConfiguration];
        self.session = [NSURLSession sessionWithConfiguration:config];
    }
    return self;
}

- (void)setBaseURL:(NSString *)baseURL {
    _baseURL = baseURL;
}

- (void)setAuthToken:(NSString *)authToken {
    _authToken = authToken;
}

- (void)setRefreshToken:(NSString *)refreshToken {
    _refreshToken = refreshToken;
}

- (void)refreshAuthTokenWithCompletion:(void (^)(BOOL success, NSError * _Nullable error))completion {
    if (!self.refreshToken || !self.baseURL) {
        if (completion) {
            completion(NO, [NSError errorWithDomain:@"JikoSyncError" code:1001 userInfo:@{NSLocalizedDescriptionKey: @"Missing refresh token or base URL"}]);
        }
        return;
    }
    
    NSString *urlString = [NSString stringWithFormat:@"%@/auth/refresh", self.baseURL];
    NSURL *url = [NSURL URLWithString:urlString];
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
    [request setHTTPMethod:@"POST"];
    
    NSDictionary *body = @{@"refresh_token": self.refreshToken};
    NSError *jsonError;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:body options:0 error:&jsonError];
    
    if (jsonError) {
        if (completion) {
            completion(NO, jsonError);
        }
        return;
    }
    
    [request setHTTPBody:jsonData];
    [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
    
    NSURLSessionDataTask *task = [self.session dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        if (error) {
            dispatch_async(dispatch_get_main_queue(), ^{
                if (completion) {
                    completion(NO, error);
                }
            });
            return;
        }
        
        NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
        if (httpResponse.statusCode == 200) {
            NSError *jsonParseError;
            NSDictionary *jsonResponse = [NSJSONSerialization JSONObjectWithData:data options:0 error:&jsonParseError];
            
            if (jsonParseError) {
                dispatch_async(dispatch_get_main_queue(), ^{
                    if (completion) {
                        completion(NO, jsonParseError);
                    }
                });
                return;
            }
            
            NSString *newAuthToken = jsonResponse[@"access_token"];
            if (newAuthToken) {
                self.authToken = newAuthToken;
                dispatch_async(dispatch_get_main_queue(), ^{
                    if (completion) {
                        completion(YES, nil);
                    }
                });
            } else {
                NSError *tokenError = [NSError errorWithDomain:@"JikoSyncError" code:1002 userInfo:@{NSLocalizedDescriptionKey: @"Failed to extract access token from response"}];
                dispatch_async(dispatch_get_main_queue(), ^{
                    if (completion) {
                        completion(NO, tokenError);
                    }
                });
            }
        } else {
            NSString *errorMessage = [NSString stringWithFormat:@"HTTP Error %ld", (long)httpResponse.statusCode];
            NSError *httpError = [NSError errorWithDomain:@"JikoSyncError" code:httpResponse.statusCode userInfo:@{NSLocalizedDescriptionKey: errorMessage}];
            dispatch_async(dispatch_get_main_queue(), ^{
                if (completion) {
                    completion(NO, httpError);
                }
            });
        }
    }];
    
    [task resume];
}

- (void)postToEndpoint:(NSString *)endpoint withData:(NSDictionary *)data completion:(void (^)(BOOL success, NSError * _Nullable error))completion {
    if (!self.baseURL || !self.authToken) {
        if (completion) {
            NSError *error = [NSError errorWithDomain:@"JikoSyncError" code:1003 userInfo:@{NSLocalizedDescriptionKey: @"Base URL or auth token not set"}];
            completion(NO, error);
        }
        return;
    }
    
    NSString *urlString = [NSString stringWithFormat:@"%@%@", self.baseURL, endpoint];
    NSURL *url = [NSURL URLWithString:urlString];
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
    [request setHTTPMethod:@"POST"];
    
    NSError *jsonError;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:data options:0 error:&jsonError];
    
    if (jsonError) {
        if (completion) {
            completion(NO, jsonError);
        }
        return;
    }
    
    [request setHTTPBody:jsonData];
    [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
    [request setValue:[NSString stringWithFormat:@"Bearer %@", self.authToken] forHTTPHeaderField:@"Authorization"];
    
    NSURLSessionDataTask *task = [self.session dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        if (error) {
            dispatch_async(dispatch_get_main_queue(), ^{
                if (completion) {
                    completion(NO, error);
                }
            });
            return;
        }
        
        NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
        if (httpResponse.statusCode >= 200 && httpResponse.statusCode < 300) {
            dispatch_async(dispatch_get_main_queue(), ^{
                if (completion) {
                    completion(YES, nil);
                }
            });
        } else if (httpResponse.statusCode == 401) {
            // Token might be expired, try to refresh
            [self refreshAuthTokenWithCompletion:^(BOOL success, NSError * _Nullable refreshError) {
                if (success) {
                    // Retry the original request
                    [self postToEndpoint:endpoint withData:data completion:completion];
                } else {
                    dispatch_async(dispatch_get_main_queue(), ^{
                        if (completion) {
                            completion(NO, refreshError ?: [NSError errorWithDomain:@"JikoSyncError" code:401 userInfo:@{NSLocalizedDescriptionKey: @"Authentication failed"}]);
                        }
                    });
                }
            }];
        } else {
            NSString *errorMessage = [NSString stringWithFormat:@"HTTP Error %ld", (long)httpResponse.statusCode];
            NSError *httpError = [NSError errorWithDomain:@"JikoSyncError" code:httpResponse.statusCode userInfo:@{NSLocalizedDescriptionKey: errorMessage}];
            dispatch_async(dispatch_get_main_queue(), ^{
                if (completion) {
                    completion(NO, httpError);
                }
            });
        }
    }];
    
    [task resume];
}

- (void)syncAppUsageData:(NSDictionary *)data completion:(void (^)(BOOL success, NSError * _Nullable error))completion {
    [self postToEndpoint:@"/sync/app-usage" withData:data completion:completion];
}

- (void)syncLocationData:(NSDictionary *)data completion:(void (^)(BOOL success, NSError * _Nullable error))completion {
    [self postToEndpoint:@"/sync/location" withData:data completion:completion];
}

- (void)syncHealthData:(NSDictionary *)data completion:(void (^)(BOOL success, NSError * _Nullable error))completion {
    [self postToEndpoint:@"/sync/health" withData:data completion:completion];
}

@end