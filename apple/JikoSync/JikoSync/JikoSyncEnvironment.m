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
  env.timestamp = [NSDate date];
  
#if TARGET_OS_IOS
  UIDevice *device = [UIDevice currentDevice];
  device.batteryMonitoringEnabled = YES;
  env.batteryLevel = device.batteryLevel;
  env.isCharging = (device.batteryState == UIDeviceBatteryStateCharging ||
                    device.batteryState == UIDeviceBatteryStateFull);
#elif TARGET_OS_MAC
  // macOS: use IOKit for battery info
  CFTypeRef blob = IOPSCopyPowerSourcesInfo();
  CFArrayRef sources = IOPSCopyPowerSourcesList(blob);
  env.batteryLevel = 0.0;
  env.isCharging = NO;
  
  if (CFArrayGetCount(sources) > 0) {
    CFDictionaryRef info = IOPSGetPowerSourceDescription(blob, CFArrayGetValueAtIndex(sources, 0));
    if (info) {
      NSNumber *capacity = (__bridge NSNumber *)CFDictionaryGetValue(info, CFSTR(kIOPSCurrentCapacityKey));
      NSNumber *max = (__bridge NSNumber *)CFDictionaryGetValue(info, CFSTR(kIOPSMaxCapacityKey));
      NSString *state = (__bridge NSString *)CFDictionaryGetValue(info, CFSTR(kIOPSPowerSourceStateKey));
      
      env.batteryLevel = (capacity.floatValue / max.floatValue);
      env.isCharging = [state isEqualToString:@kIOPSACPowerValue];
    }
  }
  if (blob) CFRelease(blob);
  if (sources) CFRelease(sources);
#endif
  
  env.location = CLLocationCoordinate2DMake(0, 0);
  return env;
}

@end
