//
//  JikoHealthData.h
//  JikoSync
//
//  Created by Hadi Ahmad on 11/2/25.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface JikoHealthLog : NSObject

@property (nonatomic, strong) NSString *timestamp;
@property (nonatomic, strong) NSString *startTime;
@property (nonatomic, strong) NSString *endTime;
@property (nonatomic, strong, nullable) NSArray<NSString *> *tags;
@property (nonatomic, strong) NSDictionary *metrics;

- (instancetype)initWithStartTime:(NSString *)startTime
                          endTime:(NSString *)endTime
                           metrics:(NSDictionary *)metrics;

- (NSDictionary *)toDictionary;

@end

@interface JikoHealthData : NSObject

@property (nonatomic, strong) NSString *timestamp;
@property (nonatomic, strong) NSString *platform;
@property (nonatomic, strong) NSString *deviceId;
@property (nonatomic, strong) NSArray<JikoHealthLog *> *log;

- (instancetype)initWithPlatform:(NSString *)platform
                        deviceId:(NSString *)deviceId
                             log:(NSArray<JikoHealthLog *> *)log;

- (NSDictionary *)toDictionary;

@end

NS_ASSUME_NONNULL_END