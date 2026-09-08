//
//  JikoSyncAPI.h
//  JikoSync
//
//  Created by Hadi Ahmad on 11/2/25.
//

#import <Foundation/Foundation.h>
#import "JikoSyncEvent.h"

NS_ASSUME_NONNULL_BEGIN

@interface JikoSyncAPI : NSObject

// Singleton instance
+ (instancetype)sharedAPI;

// Set the base URL for API requests
- (void)setBaseURL:(NSString *)baseURL;

// Set the authentication token
- (void)setAuthToken:(NSString *)authToken;

// Set the refresh token
- (void)setRefreshToken:(NSString *)refreshToken;

// Refresh the authentication token using the refresh token
- (void)refreshAuthTokenWithCompletion:(void (^)(BOOL success, NSError * _Nullable error))completion;

// Sync app usage data
- (void)syncAppUsageData:(NSDictionary *)data completion:(void (^)(BOOL success, NSError * _Nullable error))completion;

// Sync location data
- (void)syncLocationData:(NSDictionary *)data completion:(void (^)(BOOL success, NSError * _Nullable error))completion;

// Sync health data
- (void)syncHealthData:(NSDictionary *)data completion:(void (^)(BOOL success, NSError * _Nullable error))completion;

// Generic POST request method
- (void)postToEndpoint:(NSString *)endpoint withData:(NSDictionary *)data completion:(void (^)(BOOL success, NSError * _Nullable error))completion;

@end

NS_ASSUME_NONNULL_END