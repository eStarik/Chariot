#!/bin/sh
mkdir -p /root/.kube
cp /tmp/kubeconfig /root/.kube/config
# Fix for Docker Desktop K8s access from within container
sed -i 's/127.0.0.1/host.docker.internal/g' /root/.kube/config
exec node index.js
