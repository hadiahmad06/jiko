//
//  JikoSyncManager.h
//  JikoSync
//
//  Created by Hadi Ahmad on 10/15/25.
//

#import <Foundation/Foundation.h>
#import "JikoSyncEvent.h"
#import "JikoSyncEnvironment.h"

NS_ASSUME_NONNULL_BEGIN

@interface JikoSyncManager : NSObject

// Singleton instance
+ (instancetype)sharedManager;

// Start syncing events
- (void)startSyncing;

// Stop syncing
- (void)stopSyncing;

// Log an app event manually (optional)
- (void)logEvent:(JikoSyncEvent *)event;

// Get current environmental context snapshot
- (JikoSyncEnvironment *)currentEnvironmentSnapshot;

// Callback for when events are synced
@property (nonatomic, copy) void (^onEventSynced)(JikoSyncEvent *event);

@end

NS_ASSUME_NONNULL_END
