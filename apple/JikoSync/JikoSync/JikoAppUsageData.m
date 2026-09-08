//
//  JikoAppUsageData.m
//  JikoSync
//
//  Created by Hadi Ahmad on 11/2/25.
//

#import "JikoAppUsageData.h"

@implementation JikoAppUsageLog

- (instancetype)initWithBundleId:(NSString *)bundleId
                       timestamp:(NSString *)timestamp
                         appName:(NSString *)appName
                       startTime:(NSString *)startTime
                  durationSeconds:(NSInteger)durationSeconds {
    self = [super init];
    if (self) {
        _bundleId = bundleId;
        _timestamp = timestamp;
        _appName = appName;
        _startTime = startTime;
        _durationSeconds = durationSeconds;
        _isForeground = YES; // Default to foreground
    }
    return self;
}

- (NSDictionary *)toDictionary {
    NSMutableDictionary *dict = [NSMutableDictionary dictionary];
    dict[@"bundleId"] = self.bundleId;
    dict[@"timestamp"] = self.timestamp;
    dict[@"appName"] = self.appName;
    dict[@"startTime"] = self.startTime;
    dict[@"durationSeconds"] = @(self.durationSeconds);
    
    if (self.category) {
        dict[@"category"] = self.category;
    }
    
    dict[@"isForeground"] = @(self.isForeground);
    
    if (self.windowTitle) {
        dict[@"windowTitle"] = self.windowTitle;
    }
    
    return [dict copy];
}

@end

@implementation JikoAppUsageData

- (instancetype)initWithPlatform:(NSString *)platform
                        deviceId:(NSString *)deviceId
                             log:(NSArray<JikoAppUsageLog *> *)log {
    self = [super init];
    if (self) {
        NSISO8601DateFormatter *formatter = [[NSISO8601DateFormatter alloc] init];
        _timestamp = [formatter stringFromDate:[NSDate date]];
        _platform = platform;
        _deviceId = deviceId;
        _log = [log copy];
    }
    return self;
}

- (NSDictionary *)toDictionary {
    NSMutableDictionary *dict = [NSMutableDictionary dictionary];
    dict[@"timestamp"] = self.timestamp;
    dict[@"platform"] = self.platform;
    dict[@"device_id"] = self.deviceId;
    
    NSMutableArray *logArray = [NSMutableArray array];
    for (JikoAppUsageLog *logEntry in self.log) {
        [logArray addObject:[logEntry toDictionary]];
    }
    dict[@"log"] = [logArray copy];
    
    return [dict copy];
}

@end