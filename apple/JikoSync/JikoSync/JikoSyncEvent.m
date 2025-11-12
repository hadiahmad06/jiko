//
//  JikoSyncEvent.m
//  JikoSync
//
//  Created by Hadi Ahmad on 10/15/25.
//

#import "JikoSyncEvent.h"

@implementation JikoSyncEvent

+ (instancetype)eventWithAppIdentifier:(NSString *)appIdentifier
                                  type:(JikoSyncEventType)type
                              metadata:(NSDictionary *)metadata {
    JikoSyncEvent *event = [[JikoSyncEvent alloc] init];
    event.appIdentifier = appIdentifier;
    event.type = type;
    event.timestamp = [NSDate date];
    event.metadata = metadata;
    return event;
}

@end
