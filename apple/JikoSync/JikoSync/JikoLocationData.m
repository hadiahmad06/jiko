//
//  JikoLocationData.m
//  JikoSync
//
//  Created by Hadi Ahmad on 11/2/25.
//

#import "JikoLocationData.h"

@implementation JikoLocationData

- (instancetype)initWithPlatform:(NSString *)platform
                        deviceId:(NSString *)deviceId
                        location:(CLLocation *)location {
    self = [super init];
    if (self) {
        NSISO8601DateFormatter *formatter = [[NSISO8601DateFormatter alloc] init];
        _timestamp = [formatter stringFromDate:[NSDate date]];
        _platform = platform;
        _deviceId = deviceId;
        _latitude = location.coordinate.latitude;
        _longitude = location.coordinate.longitude;
        _radius = location.horizontalAccuracy;
        _altitude = location.altitude;
    }
    return self;
}

- (NSDictionary *)toDictionary {
    NSMutableDictionary *dict = [NSMutableDictionary dictionary];
    dict[@"timestamp"] = self.timestamp;
    dict[@"platform"] = self.platform;
    dict[@"device_id"] = self.deviceId;
    dict[@"latitude"] = @(self.latitude);
    dict[@"longitude"] = @(self.longitude);
    dict[@"radius"] = @(self.radius);
    dict[@"altitude"] = @(self.altitude);
    
    return [dict copy];
}

@end