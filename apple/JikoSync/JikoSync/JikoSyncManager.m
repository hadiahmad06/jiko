//
//  JikoSyncManager.m
//  JikoSync
//
//  Created by Hadi Ahmad on 10/15/25.
//

#import "JikoSyncManager.h"
#import "JikoSyncAPI.h"
#import "JikoDataQueue.h"

@interface JikoSyncManager ()
@property (nonatomic, strong) NSMutableArray<JikoSyncEvent *> *eventQueue;
@property (nonatomic, strong) NSTimer *syncTimer;
@property (nonatomic, strong) NSTimer *queueProcessingTimer;
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
    // Sync events every 10 seconds
    self.syncTimer = [NSTimer scheduledTimerWithTimeInterval:10.0
                                                      target:self
                                                    selector:@selector(syncEvents)
                                                    userInfo:nil
                                                     repeats:YES];
    
    // Process queued data every 30 seconds
    self.queueProcessingTimer = [NSTimer scheduledTimerWithTimeInterval:30.0
                                                                target:self
                                                              selector:@selector(processQueuedData)
                                                              userInfo:nil
                                                               repeats:YES];
}

- (void)stopSyncing {
    [self.syncTimer invalidate];
    self.syncTimer = nil;
    
    [self.queueProcessingTimer invalidate];
    self.queueProcessingTimer = nil;
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

- (void)queueAppUsageData:(JikoAppUsageData *)appUsageData {
    JikoDataQueueItem *item = [[JikoDataQueueItem alloc] initWithDataType:JikoDataTypeAppUsage
                                                                     data:[appUsageData toDictionary]
                                                                timestamp:[NSDate date]];
    [[JikoDataQueue sharedQueue] enqueueData:item];
}

- (void)queueLocationData:(JikoLocationData *)locationData {
    JikoDataQueueItem *item = [[JikoDataQueueItem alloc] initWithDataType:JikoDataTypeLocation
                                                                     data:[locationData toDictionary]
                                                                timestamp:[NSDate date]];
    [[JikoDataQueue sharedQueue] enqueueData:item];
}

- (void)queueHealthData:(JikoHealthData *)healthData {
    JikoDataQueueItem *item = [[JikoDataQueueItem alloc] initWithDataType:JikoDataTypeHealth
                                                                     data:[healthData toDictionary]
                                                                timestamp:[NSDate date]];
    [[JikoDataQueue sharedQueue] enqueueData:item];
}

// Temporary fix for efficiency - only send data when the user has already had the app open for a minute
- (BOOL)shouldSendDataBasedOnAppUsage:(NSDictionary *)appUsageData {
    // This is a placeholder implementation
    // In a real implementation, you would check if the app has been open for more than a minute
    return YES; // For now, always send data
}

- (void)processQueuedData {
    JikoSyncAPI *api = [JikoSyncAPI sharedAPI];
    JikoDataQueue *queue = [JikoDataQueue sharedQueue];
    // Items are removed inside each completion handler, after the server has
    // accepted them. Never before: the old code removed synchronously and lost data.
    for (JikoDataQueueItem *item in [queue allQueuedData]) {
        void (^done)(BOOL, NSError * _Nullable) = ^(BOOL success, NSError * _Nullable error) {
            if (success) {
                [queue removeItems:@[item]];
            } else {
                NSLog(@"[JikoSync] sync failed (%ld): %@", (long)item.dataType, error.localizedDescription);
            }
        };
        switch (item.dataType) {
            case JikoDataTypeAppUsage:
                if ([self shouldSendDataBasedOnAppUsage:item.data]) [api syncAppUsageData:item.data completion:done];
                break;
            case JikoDataTypeLocation:
                [api syncLocationData:item.data completion:done];
                break;
            case JikoDataTypeHealth:
                [api syncHealthData:item.data completion:done];
                break;
        }
    }
}

@end
