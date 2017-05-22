# (C) Copyright IBM Corporation 2017.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

FROM ubuntu:14.04

# Install required OS tools
RUN apt-get update \
  && apt-get install -qq -y --no-install-recommends \
    cpio \
    make \
    gcc \
    g++ \
    libx11-dev \
    libxext-dev \
    libxrender-dev \
    libxtst-dev \
    libxt-dev \
    libcups2-dev \
    libfreetype6-dev \
    libasound2-dev \
    openjdk-7-jdk \
    ccache \
    zip \
    wget \
    git \
    unzip \
    mercurial \
&& rm -rf /var/lib/apt/lists/*

# Clone JDK8
RUN mkdir -p /openjdk/jdk8u
RUN hg clone http://hg.openjdk.java.net/jdk8u/jdk8u /openjdk/jdk8u

WORKDIR /openjdk/jdk8u
RUN sh ./get_source.sh
RUN sh ./make/scripts/hgforest.sh pull -u

# Get build script
COPY build.sh /bin/

ENV JDK_BOOT_DIR=/usr/lib/jvm/java-1.7.0-openjdk-amd64

RUN chmod +x configure \
    && ./configure --with-target-bits=64 \
        --with-freetype-include=/usr/include/freetype2/ \
        --with-freetype-lib=/usr/lib/x86_64-linux-gnu \
    && make langtools

# Default actions
ENTRYPOINT sleep 1000