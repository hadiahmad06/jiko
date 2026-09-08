//
//  JikoDataQueue.h
//  JikoSync
//
//  Created by Hadi Ahmad on 11/2/25.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSInteger, JikoDataType) {
    JikoDataTypeAppUsage,
    JikoDataTypeLocation,
    JikoDataTypeHealth
};

@interface JikoDataQueueItem : NSObject

@property (nonatomic, assign) JikoDataType dataType;
@property (nonatomic, strong) NSDictionary *data;
@property (nonatomic, strong) NSDate *timestamp;
@property (nonatomic, strong) NSString *identifier;

- (instancetype)initWithDataType:(JikoDataType)dataType
                            data:(NSDictionary *)data
                       timestamp:(NSDate *)timestamp;

@end

@interface JikoDataQueue : NSObject

// Singleton instance
+ (instancetype)sharedQueue;

// Add data to the queue
- (void)enqueueData:(JikoDataQueueItem *)item;

// Get all queued data
- (NSArray<JikoDataQueueItem *> *)allQueuedData;

// Get queued data by type
- (NSArray<JikoDataQueueItem *> *)queuedDataOfType:(JikoDataType)type;

// Remove specific items from the queue
- (void)removeItems:(NSArray<JikoDataQueueItem *> *)items;

// Clear all data from the queue
- (void)clearAllData;

// Get the number of items in the queue
- (NSUInteger)count;

// Get the number of items of a specific type
- (NSUInteger)countOfType:(JikoDataType)type;

@end

NS_ASSUME_NONNULL_END