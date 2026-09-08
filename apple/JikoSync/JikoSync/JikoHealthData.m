//
//  JikoHealthData.m
//  JikoSync
//
//  Created by Hadi Ahmad on 11/2/25.
//

#import "JikoHealthData.h"

@implementation JikoHealthLog

- (instancetype)initWithStartTime:(NSString *)startTime
                          endTime:(NSString *)endTime
                          metrics:(NSDictionary *)metrics {
    self = [super init];
    if (self) {
        _timestamp = endTime; // Using end_time as timestamp
        _startTime = startTime;
        _endTime = endTime;
        _metrics = [metrics copy];
    }
    return self;
}

- (NSDictionary *)toDictionary {
    NSMutableDictionary *dict = [NSMutableDictionary dictionary];
    dict[@"timestamp"] = self.timestamp;
    dict[@"start_time"] = self.startTime;
    dict[@"end_time"] = self.endTime;
    
    if (self.tags) {
        dict[@"tags"] = self.tags;
    }
    
    // Add all metrics to the dictionary
    [dict addEntriesFromDictionary:self.metrics];
    
    return [dict copy];
}

@end

@implementation JikoHealthData

- (instancetype)initWithPlatform:(NSString *)platform
                        deviceId:(NSString *)deviceId
                             log:(NSArray<JikoHealthLog *> *)log {
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
    for (JikoHealthLog *logEntry in self.log) {
        [logArray addObject:[logEntry toDictionary]];
    }
    dict[@"log"] = [logArray copy];
    
    return [dict copy];
}

@end