//
//  JikoLocationData.h
//  JikoSync
//
//  Created by Hadi Ahmad on 11/2/25.
//

#import <Foundation/Foundation.h>
#import <CoreLocation/CoreLocation.h>

NS_ASSUME_NONNULL_BEGIN

@interface JikoLocationData : NSObject

@property (nonatomic, strong) NSString *timestamp;
@property (nonatomic, strong) NSString *platform;
@property (nonatomic, strong) NSString *deviceId;
@property (nonatomic, assign) double latitude;
@property (nonatomic, assign) double longitude;
@property (nonatomic, assign) double radius;
@property (nonatomic, assign) double altitude;

- (instancetype)initWithPlatform:(NSString *)platform
                        deviceId:(NSString *)deviceId
                        location:(CLLocation *)location;

- (NSDictionary *)toDictionary;

@end

NS_ASSUME_NONNULL_END