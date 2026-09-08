#!/bin/bash

# Clean up any previous build
rm -rf build_static
mkdir -p build_static

# Compile all source files
echo "Compiling source files..."
clang -x objective-c -fmodules -fobjc-arc -I./JikoSync -c JikoSync/JikoSyncManager.m -o build_static/JikoSyncManager.o
clang -x objective-c -fmodules -fobjc-arc -I./JikoSync -c JikoSync/JikoSyncEvent.m -o build_static/JikoSyncEvent.o
clang -x objective-c -fmodules -fobjc-arc -I./JikoSync -c JikoSync/JikoSyncEnvironment.m -o build_static/JikoSyncEnvironment.o
clang -x objective-c -fmodules -fobjc-arc -I./JikoSync -c JikoSync/JikoSyncAPI.m -o build_static/JikoSyncAPI.o
clang -x objective-c -fmodules -fobjc-arc -I./JikoSync -c JikoSync/JikoAppUsageData.m -o build_static/JikoAppUsageData.o
clang -x objective-c -fmodules -fobjc-arc -I./JikoSync -c JikoSync/JikoLocationData.m -o build_static/JikoLocationData.o
clang -x objective-c -fmodules -fobjc-arc -I./JikoSync -c JikoSync/JikoHealthData.m -o build_static/JikoHealthData.o
clang -x objective-c -fmodules -fobjc-arc -I./JikoSync -c JikoSync/JikoDataQueue.m -o build_static/JikoDataQueue.o

# Create static library
echo "Creating static library..."
ar rcs build_static/libJikoSync.a build_static/JikoSyncManager.o build_static/JikoSyncEvent.o build_static/JikoSyncEnvironment.o build_static/JikoSyncAPI.o build_static/JikoAppUsageData.o build_static/JikoLocationData.o build_static/JikoHealthData.o build_static/JikoDataQueue.o

# Copy headers
echo "Copying headers..."
mkdir -p build_static/headers
cp JikoSync/*.h build_static/headers/

echo "Static library built successfully!"
echo "Library: build_static/libJikoSync.a"
echo "Headers: build_static/headers/"