#!/bin/bash

# Clean up any previous build
rm -rf build
mkdir -p build

# Compile all source files
clang -x objective-c -fmodules -fobjc-arc -I./JikoSync -c JikoSync/JikoSyncManager.m -o build/JikoSyncManager.o
clang -x objective-c -fmodules -fobjc-arc -I./JikoSync -c JikoSync/JikoSyncEvent.m -o build/JikoSyncEvent.o
clang -x objective-c -fmodules -fobjc-arc -I./JikoSync -c JikoSync/JikoSyncEnvironment.m -o build/JikoSyncEnvironment.o
clang -x objective-c -fmodules -fobjc-arc -I./JikoSync -c JikoSync/JikoSyncAPI.m -o build/JikoSyncAPI.o
clang -x objective-c -fmodules -fobjc-arc -I./JikoSync -c JikoSync/JikoAppUsageData.m -o build/JikoAppUsageData.o
clang -x objective-c -fmodules -fobjc-arc -I./JikoSync -c JikoSync/JikoLocationData.m -o build/JikoLocationData.o
clang -x objective-c -fmodules -fobjc-arc -I./JikoSync -c JikoSync/JikoHealthData.m -o build/JikoHealthData.o
clang -x objective-c -fmodules -fobjc-arc -I./JikoSync -c JikoSync/JikoDataQueue.m -o build/JikoDataQueue.o

# Create static library
ar rcs build/libJikoSync.a build/JikoSyncManager.o build/JikoSyncEvent.o build/JikoSyncEnvironment.o build/JikoSyncAPI.o build/JikoAppUsageData.o build/JikoLocationData.o build/JikoHealthData.o build/JikoDataQueue.o

# Copy headers
mkdir -p build/headers
cp JikoSync/*.h build/headers/

echo "Framework built successfully!"
echo "Library: build/libJikoSync.a"
echo "Headers: build/headers/"