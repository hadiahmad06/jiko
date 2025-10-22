//
//  JikoSyncEnvironment.m
//  JikoSync
//
//  Created by Hadi Ahmad on 10/15/25.
//

#import "JikoSyncEnvironment.h"
#import <UIKit/UIKit.h>
#import <CoreLocation/CoreLocation.h>

@implementation JikoSyncEnvironment

+ (instancetype)snapshot {
    JikoSyncEnvironment *env = [[JikoSyncEnvironment alloc] init];
    
    UIDevice *device = [UIDevice currentDevice];
    device.batteryMonitoringEnabled = YES;
    
    env.batteryLevel = device.batteryLevel;
    env.isCharging = (device.batteryState == UIDeviceBatteryStateCharging || device.batteryState == UIDeviceBatteryStateFull);
    env.timestamp = [NSDate date];
    
    // Example: use CoreLocation for actual location
    env.location = CLLocationCoordinate2DMake(0, 0); // placeholder
    
    return env;
}

@end
