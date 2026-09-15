# Sistema de Monitoramento Agrícola

Sistema de monitoramento agrícola distribuído, composto por sensores simulados (TCP), um gateway que coleta e agrega as leituras, e uma interface web que exibe os dados em tempo real.

## Arquitetura

- **Sensores** (`src/sensores2/sensor.ts`): servidores TCP que simulam leituras de temperatura, umidade e incidência solar. Cada instância representa um sensor (S1, S2, S3), rodando em sua própria porta e gerando valores aleatórios sob demanda.
- **Gateway** (`src/gateway/gateway.ts`): conecta-se via TCP aos três sensores, coleta as leituras, calcula as médias (temperatura, umidade e incidência solar) e mantém um histórico em memória. Também expõe um servidor HTTP na porta `8080` com:
  - `/` — interface web (`src/interface/index.html`)
  - `/api/dados` — histórico de médias em formato JSON
- **Modelo** (`src/modelos/leituraSensor.ts`): classe `LeituraSensor`, estrutura de dados compartilhada entre sensores e gateway.
- **Interface** (`src/interface/index.html`): página web simples que exibe as médias mais recentes e o histórico de leituras.

## Tecnologias

- TypeScript
- Node.js (módulos `net`, `http`, `fs`, `path`)
- [tsx](https://github.com/privatenumber/tsx) para execução direta dos arquivos `.ts`

## Pré-requisitos

- Node.js instalado
- Dependências instaladas:
  ```
  npm install
  ```

## Como executar

### 1. Subir os sensores

Cada sensor deve ser iniciado em um terminal separado, informando a porta e o nome:

```
npx tsx src/sensores2/sensor.ts 3001 S1
npx tsx src/sensores2/sensor.ts 3002 S2
npx tsx src/sensores2/sensor.ts 3003 S3
```

### 2. Subir o gateway

Em outro terminal:

```
npx tsx src/gateway/gateway.ts
```

O gateway se conecta aos três sensores, coleta as leituras e calcula as médias periodicamente.

### 3. Acessar a interface web

Com o gateway em execução, acesse:

```
http://localhost:8080
```

## Estrutura do projeto

```
src/
├── gateway/
│   └── gateway.ts        # Coleta dados dos sensores e serve a interface web
├── sensores2/
│   └── sensor.ts         # Simula um sensor TCP individual
├── modelos/
│   └── leituraSensor.ts  # Classe LeituraSensor
└── interface/
    └── index.html        # Interface web de monitoramento
```
