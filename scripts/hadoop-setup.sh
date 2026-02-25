#!/bin/bash

# Smart Attendance System - Hadoop Cluster Setup Script
# This script sets up Hadoop on a Linux machine for big data analytics

set -e

HADOOP_VERSION="3.3.6"
HADOOP_HOME="/opt/hadoop"
HADOOP_USER="hadoop"
JAVA_HOME="/usr/lib/jvm/java-11-openjdk-amd64"

echo "================================"
echo "Hadoop Cluster Setup for Attendance Analytics"
echo "================================"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
   echo "Please run this script as root (sudo)"
   exit 1
fi

# Update system packages
echo "Updating system packages..."
apt-get update
apt-get upgrade -y
apt-get install -y openjdk-11-jdk-headless curl wget openssh-server openssh-client

# Create hadoop user
echo "Creating hadoop user..."
if ! id "$HADOOP_USER" &>/dev/null; then
    useradd -m -s /bin/bash $HADOOP_USER
    echo "Hadoop user created"
fi

# Create hadoop directory
echo "Setting up Hadoop directories..."
mkdir -p $HADOOP_HOME
chown -R $HADOOP_USER:$HADOOP_USER $HADOOP_HOME

# Download and install Hadoop
echo "Downloading Hadoop $HADOOP_VERSION..."
cd /tmp
wget -q "https://archive.apache.org/dist/hadoop/common/hadoop-${HADOOP_VERSION}/hadoop-${HADOOP_VERSION}.tar.gz"
tar -xzf "hadoop-${HADOOP_VERSION}.tar.gz"
cp -r "hadoop-${HADOOP_VERSION}"/* $HADOOP_HOME/
rm -rf "hadoop-${HADOOP_VERSION}" "hadoop-${HADOOP_VERSION}.tar.gz"

# Setup SSH for Hadoop
echo "Configuring SSH for Hadoop..."
sudo -u $HADOOP_USER ssh-keygen -t rsa -P "" -f /home/$HADOOP_USER/.ssh/id_rsa
cat /home/$HADOOP_USER/.ssh/id_rsa.pub >> /home/$HADOOP_USER/.ssh/authorized_keys
chmod 600 /home/$HADOOP_USER/.ssh/authorized_keys

# Create Hadoop configuration files
echo "Creating Hadoop configuration files..."

# core-site.xml
cat > $HADOOP_HOME/etc/hadoop/core-site.xml << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="configuration.xsl"?>
<configuration>
    <property>
        <name>fs.defaultFS</name>
        <value>hdfs://localhost:9000</value>
    </property>
    <property>
        <name>hadoop.tmp.dir</name>
        <value>/tmp/hadoop</value>
    </property>
</configuration>
EOF

# hdfs-site.xml
cat > $HADOOP_HOME/etc/hadoop/hdfs-site.xml << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="configuration.xsl"?>
<configuration>
    <property>
        <name>dfs.replication</name>
        <value>1</value>
    </property>
    <property>
        <name>dfs.namenode.name.dir</name>
        <value>/tmp/hadoop/namenode</value>
    </property>
    <property>
        <name>dfs.datanode.data.dir</name>
        <value>/tmp/hadoop/datanode</value>
    </property>
</configuration>
EOF

# mapred-site.xml
cat > $HADOOP_HOME/etc/hadoop/mapred-site.xml << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="configuration.xsl"?>
<configuration>
    <property>
        <name>mapreduce.framework.name</name>
        <value>yarn</value>
    </property>
</configuration>
EOF

# yarn-site.xml
cat > $HADOOP_HOME/etc/hadoop/yarn-site.xml << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="configuration.xsl"?>
<configuration>
    <property>
        <name>yarn.nodemanager.aux-services</name>
        <value>mapreduce_shuffle</value>
    </property>
    <property>
        <name>yarn.nodemanager.aux-services.mapreduce.shuffle.class</name>
        <value>org.apache.hadoop.hive.ql.exec.FunctionRegistry</value>
    </property>
</configuration>
EOF

# Set permissions
chown -R $HADOOP_USER:$HADOOP_USER $HADOOP_HOME

# Setup environment variables for hadoop user
echo "Setting up environment variables..."
cat >> /home/$HADOOP_USER/.bashrc << 'EOF'
export JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64
export HADOOP_HOME=/opt/hadoop
export PATH=$PATH:$HADOOP_HOME/bin:$HADOOP_HOME/sbin
export HADOOP_CONF_DIR=$HADOOP_HOME/etc/hadoop
EOF

# Format HDFS namenode
echo "Formatting HDFS namenode..."
sudo -u $HADOOP_USER bash -c 'source /home/hadoop/.bashrc && hdfs namenode -format -force'

echo "================================"
echo "Hadoop setup complete!"
echo "================================"
echo ""
echo "To start Hadoop:"
echo "  sudo su - hadoop"
echo "  start-dfs.sh"
echo "  start-yarn.sh"
echo ""
echo "Web UIs:"
echo "  HDFS: http://localhost:9870"
echo "  YARN: http://localhost:8088"
