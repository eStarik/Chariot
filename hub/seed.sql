INSERT INTO formations (id, name, version, description, cpu, memory, tickrate, yaml_config)
VALUES ('mc-java-1-21-1', 'Minecraft Java 1.21.1', '1.21.1', 'Minecraft Java Edition 1.21.1 dedicated server.', '1', '4Gi', '20Hz', 'apiVersion: "agones.dev/v1"
kind: GameServer
metadata:
  generateName: mc-java-1-21-1-
  labels:
    chariot.tactical/formation: "mc-java"
spec:
  ports:
  - name: default
    containerPort: 25565
    protocol: TCP
  template:
    spec:
      containers:
      - name: mc-server
        image: "itzg/minecraft-server"
        env:
        - name: EULA
          value: "TRUE"
        - name: VERSION
          value: "1.21.1"
        - name: TYPE
          value: "VANILLA"
        resources:
          requests:
            memory: "2Gi"
            cpu: "0.5"
          limits:
            memory: "4Gi"
            cpu: "1"');
