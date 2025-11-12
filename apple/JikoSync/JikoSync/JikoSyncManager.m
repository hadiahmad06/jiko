//
//  JikoSyncManager.m
//  JikoSync
//
//  Created by Hadi Ahmad on 10/15/25.
//

#import "JikoSyncManager.h"

@interface JikoSyncManager ()
@property (nonatomic, strong) NSMutableArray<JikoSyncEvent *> *eventQueue;
@property (nonatomic, strong) NSTimer *syncTimer;
@end

@implementation JikoSyncManager

+ (instancetype)sharedManager {
    static JikoSyncManager *sharedInstance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[JikoSyncManager alloc] init];
        sharedInstance.eventQueue = [NSMutableArray array];
    });
    return sharedInstance;
}

- (void)startSyncing {
    // Example: sync every 10 seconds
    self.syncTimer = [NSTimer scheduledTimerWithTimeInterval:10.0
                                                      target:self
                                                    selector:@selector(syncEvents)
                                                    userInfo:nil
                                                     repeats:YES];
}

- (void)stopSyncing {
    [self.syncTimer invalidate];
    self.syncTimer = nil;
}

- (void)logEvent:(JikoSyncEvent *)event {
    @synchronized (self.eventQueue) {
        [self.eventQueue addObject:event];
    }
}

- (void)syncEvents {
    @synchronized (self.eventQueue) {
        for (JikoSyncEvent *event in self.eventQueue) {
            // Here you would push event to server or process it
            if (self.onEventSynced) {
                self.onEventSynced(event);
            }
        }
        [self.eventQueue removeAllObjects];
    }
}

- (JikoSyncEnvironment *)currentEnvironmentSnapshot {
    return [JikoSyncEnvironment snapshot];
}

@end
