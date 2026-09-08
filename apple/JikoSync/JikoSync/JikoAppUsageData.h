//
//  JikoAppUsageData.h
//  JikoSync
//
//  Created by Hadi Ahmad on 11/2/25.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface JikoAppUsageLog : NSObject

@property (nonatomic, strong) NSString *bundleId;
@property (nonatomic, strong) NSString *timestamp;
@property (nonatomic, strong) NSString *appName;
@property (nonatomic, strong) NSString *startTime;
@property (nonatomic, assign) NSInteger durationSeconds;
@property (nonatomic, strong, nullable) NSString *category;
@property (nonatomic, assign) BOOL isForeground;
@property (nonatomic, strong, nullable) NSString *windowTitle;

- (instancetype)initWithBundleId:(NSString *)bundleId
                       timestamp:(NSString *)timestamp
                         appName:(NSString *)appName
                       startTime:(NSString *)startTime
                  durationSeconds:(NSInteger)durationSeconds;

- (NSDictionary *)toDictionary;

@end

@interface JikoAppUsageData : NSObject

@property (nonatomic, strong) NSString *timestamp;
@property (nonatomic, strong) NSString *platform;
@property (nonatomic, strong) NSString *deviceId;
@property (nonatomic, strong) NSArray<JikoAppUsageLog *> *log;

- (instancetype)initWithPlatform:(NSString *)platform
                        deviceId:(NSString *)deviceId
                             log:(NSArray<JikoAppUsageLog *> *)log;

- (NSDictionary *)toDictionary;

@end

NS_ASSUME_NONNULL_END