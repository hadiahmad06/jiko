//
//  JikoSyncEnvironment.h
//  JikoSync
//
//  Created by Hadi Ahmad on 10/15/25.
//

#import <Foundation/Foundation.h>
#import <CoreLocation/CoreLocation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface JikoSyncEnvironment : NSObject

@property (nonatomic, assign) CGFloat batteryLevel;
@property (nonatomic, assign) BOOL isCharging;
@property (nonatomic, assign) CLLocationCoordinate2D location;
@property (nonatomic, strong) NSDate *timestamp;

+ (instancetype)snapshot;

@end

NS_ASSUME_NONNULL_END
