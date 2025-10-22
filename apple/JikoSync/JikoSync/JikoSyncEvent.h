//
//  JikoSyncEvent.h
//  JikoSync
//
//  Created by Hadi Ahmad on 10/15/25.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSInteger, JikoSyncEventType) {
    JikoSyncEventTypeAppOpen,
    JikoSyncEventTypeAppClose,
    JikoSyncEventTypeCustom
};

@interface JikoSyncEvent : NSObject

@property (nonatomic, strong) NSString *appIdentifier;
@property (nonatomic, assign) JikoSyncEventType type;
@property (nonatomic, strong) NSDate *timestamp;
@property (nonatomic, strong, nullable) NSDictionary *metadata;

+ (instancetype)eventWithAppIdentifier:(NSString *)appIdentifier
                                  type:(JikoSyncEventType)type
                             metadata:(nullable NSDictionary *)metadata;

@end

NS_ASSUME_NONNULL_END