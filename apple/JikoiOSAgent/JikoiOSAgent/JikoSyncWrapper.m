//
//  JikoSyncWrapper.m
//  JikoiOSAgent
//
//  Created by Hadi Ahmad on 11/11/25.
//

#import "JikoSyncWrapper.h"
#import "JikoSyncManager.h"
#import "JikoAppUsageData.h"
#import "JikoLocationData.h"
#import "JikoHealthData.h"

@implementation JikoSyncWrapper

+ (void)initializeJikoSync {
    // TODO: Initialize JikoSyncManager and other components
    // JikoSyncManager *manager = [JikoSyncManager sharedManager];
    // NSLog(@"JikoSyncManager created: %@", manager);
}

+ (void)testJikoSyncFunctionality {
    NSLog(@"JikoSync functionality test placeholder - TODO: Test JikoSync functionality once headers are properly linked");
    
    // Test creating an app usage data object
    // JikoAppUsageLog *log = [[JikoAppUsageLog alloc] initWithBundleId:@"com.test.app"
    //                                                        timestamp:@"2025-01-01T00:00:00Z"
    //                                                          appName:@"Test App"
    //                                                        startTime:@"2025-01-01T00:00:00Z"
    //                                                   durationSeconds:60];
    // NSLog(@"Created app usage log: %@", log);
    // 
    // NSArray<JikoAppUsageLog *> *logs = @[log];
    // JikoAppUsageData *appUsageData = [[JikoAppUsageData alloc] initWithPlatform:@"ios"
    //                                                                    deviceId:@"test-device"
    //                                                                         log:logs];
    // NSLog(@"Created app usage data: %@", appUsageData);
    // 
    // [[JikoSyncManager sharedManager] queueAppUsageData:appUsageData];
    // NSLog(@"JikoSync functionality test completed successfully");
}

@end