//
//  JikoDataQueue.m
//  JikoSync
//
//  Created by Hadi Ahmad on 11/2/25.
//

#import "JikoDataQueue.h"

@implementation JikoDataQueueItem

- (instancetype)initWithDataType:(JikoDataType)dataType
                            data:(NSDictionary *)data
                       timestamp:(NSDate *)timestamp {
    self = [super init];
    if (self) {
        _dataType = dataType;
        _data = [data copy];
        _timestamp = timestamp;
        _identifier = [[NSUUID UUID] UUIDString];
    }
    return self;
}

@end

@interface JikoDataQueue ()
@property (nonatomic, strong) NSMutableArray<JikoDataQueueItem *> *queue;
@end

@implementation JikoDataQueue

+ (instancetype)sharedQueue {
    static JikoDataQueue *sharedInstance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[JikoDataQueue alloc] init];
    });
    return sharedInstance;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _queue = [NSMutableArray array];
    }
    return self;
}

- (void)enqueueData:(JikoDataQueueItem *)item {
    @synchronized(self.queue) {
        [self.queue addObject:item];
    }
}

- (NSArray<JikoDataQueueItem *> *)allQueuedData {
    @synchronized(self.queue) {
        return [self.queue copy];
    }
}

- (NSArray<JikoDataQueueItem *> *)queuedDataOfType:(JikoDataType)type {
    @synchronized(self.queue) {
        NSMutableArray<JikoDataQueueItem *> *filteredItems = [NSMutableArray array];
        for (JikoDataQueueItem *item in self.queue) {
            if (item.dataType == type) {
                [filteredItems addObject:item];
            }
        }
        return [filteredItems copy];
    }
}

- (void)removeItems:(NSArray<JikoDataQueueItem *> *)items {
    @synchronized(self.queue) {
        [self.queue removeObjectsInArray:items];
    }
}

- (void)clearAllData {
    @synchronized(self.queue) {
        [self.queue removeAllObjects];
    }
}

- (NSUInteger)count {
    @synchronized(self.queue) {
        return self.queue.count;
    }
}

- (NSUInteger)countOfType:(JikoDataType)type {
    @synchronized(self.queue) {
        NSUInteger count = 0;
        for (JikoDataQueueItem *item in self.queue) {
            if (item.dataType == type) {
                count++;
            }
        }
        return count;
    }
}

@end