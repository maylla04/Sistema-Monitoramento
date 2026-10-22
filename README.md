# Sistema de Monitoramento Agrícola

Sistema de monitoramento agrícola distribuído, com sensores simulados que alimentam gateways e uma interface web. O projeto tem duas versões:

| Versão | O que é |
|---|---|
| **Versão 1** | Sensores TCP + um gateway que calcula as médias localmente e serve a interface web |
| **Versão 2** | Dois Edges, cálculo de média e análise de anomalias em microserviços gRPC, e uma camada FOG com gatilhos |

## Pré-requisitos (as duas versões)

- Node.js instalado
- Dependências instaladas, na pasta da versão que você vai rodar:

```
npm install
```

Os comandos de cada versão devem ser executados a partir da raiz dela (a pasta que contém o `package.json`).

---

## Versão 1: Sensores e Gateway

Sensores simulados (TCP) alimentam um gateway que coleta as leituras, calcula as médias e as exibe em uma interface web em tempo real.

### Arquitetura

- **Sensores** (`src/sensores2/sensor.ts`): servidores TCP que simulam leituras de temperatura, umidade e incidência solar. Cada instância representa um sensor (S1, S2, S3), rodando em sua própria porta e gerando valores aleatórios sob demanda.
- **Gateway** (`src/gateway/gateway.ts`): conecta-se via TCP aos três sensores, coleta as leituras, calcula as médias (temperatura, umidade e incidência solar) com `calcularMedia.ts` e mantém um histórico em memória. Também expõe um servidor HTTP na porta `8080` com:
  - `/` — interface web (`src/interface/index.html`)
  - `/api/dados` — histórico de médias em formato JSON
- **Modelo** (`src/modelos/leituraSensor.ts`): classe `LeituraSensor`, estrutura de dados compartilhada entre sensores e gateway.
- **Interface** (`src/interface/index.html`): página web simples que exibe as médias mais recentes e o histórico de leituras.

### Tecnologias

- TypeScript
- Node.js (módulos `net`, `http`, `fs`, `path`)
- [tsx](https://github.com/privatenumber/tsx) para execução direta dos arquivos `.ts`

### Como executar

#### 1. Subir os sensores

Cada sensor deve ser iniciado em um terminal separado, informando a porta e o nome:

```
npx tsx src/sensores2/sensor.ts 3001 S1
npx tsx src/sensores2/sensor.ts 3002 S2
npx tsx src/sensores2/sensor.ts 3003 S3
```

#### 2. Subir o gateway

Em outro terminal:

```
npx tsx src/gateway/gateway.ts
```

O gateway se conecta aos três sensores, coleta as leituras e calcula as médias.

#### 3. Acessar a interface web

Com o gateway em execução, acesse:

```
http://localhost:8080
```

### Estrutura do projeto

```
src/
├── gateway/
│   ├── gateway.ts            # Coleta dados dos sensores, calcula as médias e serve a interface web
│   └── calcularMedia.ts      # Cálculo local das médias
├── sensores2/
│   └── sensor.ts             # Simula um sensor TCP individual
├── modelos/
│   └── leituraSensor.ts      # Classe LeituraSensor
└── interface/
    └── index.html            # Interface web de monitoramento
```

---

## Versão 2: Edge, gRPC e FOG

Organizada em camadas **Sensores → Edge → FOG**. Sensores simulados (TCP) alimentam dois gateways (Edges), que delegam o cálculo das médias a um microserviço gRPC. O FOG consulta os Edges, envia as médias a um segundo microserviço gRPC de análise de anomalias e dispara gatilhos (ex: umidade baixa → ligar irrigação).

### Arquitetura

```
Sensores S1-S3 --TCP--> EDGE 1 (gateway.ts)  --gRPC--> Serviço de média (:50051)
Sensores S4-S6 --TCP--> EDGE 2 (gateway2.ts) --gRPC--> Serviço de média (:50051)

FOG (fog.ts) --socket--> EDGE 1 (:4001) e EDGE 2 (:4002)
FOG (fog.ts) --gRPC----> Serviço de anomalias (:50052)
```

#### Sensores

`src/sensores2/sensor.ts`: servidores TCP que simulam leituras de temperatura, umidade e incidência solar. Cada instância representa um sensor (S1 a S6), roda em sua própria porta e gera valores aleatórios sob demanda quando recebe `GET_DATA`.

#### Edge 1

`src/gateway/gateway.ts`: consulta os sensores S1, S2 e S3 via TCP, envia as leituras ao serviço de média por gRPC e guarda o histórico em memória. Também:

- Serve a interface web na porta `8080`:
  - `GET /` — interface web (`src/interface/index.html`)
  - `GET /api/dados` — histórico de médias em JSON
  - `POST /api/coletar` — pede uma nova leitura dos sensores sob demanda
- Aceita conexões do FOG na porta `4001` e responde `GET_DATA` com a última média calculada.

#### Edge 2

`src/gateway2/gateway2.ts`: igual ao Edge 1, mas para os sensores S4, S5 e S6. Coleta automaticamente a cada 5 segundos e responde ao FOG na porta `4002`.

#### Serviço de média (gRPC)

`src/calculo/servidor.ts` (contrato em `calcularMedia.proto`): recebe uma lista de leituras e devolve as médias de temperatura, umidade e incidência solar. É compartilhado pelos dois Edges. Porta `50051`.

#### FOG

`src/fog/fog.ts`: servidor local que, a cada 5 segundos, consulta os dois Edges por socket, envia as médias ao serviço de anomalias e dispara os gatilhos correspondentes. Se um Edge ficar indisponível, o FOG avisa e continua com os demais.

#### Serviço de anomalias (gRPC)

`src/anomalias/servidor.ts` (contrato em `analiseAnomalias.proto`): recebe as médias dos Edges e devolve as anomalias encontradas com a ação sugerida. Porta `50052`. Os limites ficam no objeto `LIMITES` do arquivo:

| Anomalia | Condição | Gatilho |
|---|---|---|
| Umidade baixa | abaixo de 55% | Ligar irrigação |
| Temperatura alta | acima de 30 °C | Ligar ventilação |
| Radiação solar alta | acima de 850 W/m² | Acionar sombreamento |

#### Modelo e interface

- `src/modelos/leituraSensor.ts`: classe `LeituraSensor`, compartilhada entre sensores e gateways.
- `src/interface/index.html`: página web que mostra as médias mais recentes, o histórico (leitura mais nova no topo) e um botão para pedir uma nova leitura.

### Portas

| Componente | Porta | Protocolo |
|---|---|---|
| Sensores S1 a S3 | 3001, 3002, 3003 | TCP |
| Sensores S4 a S6 | 3004, 3005, 3006 | TCP |
| Edge 1 → FOG | 4001 | TCP (socket) |
| Edge 2 → FOG | 4002 | TCP (socket) |
| Interface web (Edge 1) | 8080 | HTTP |
| Serviço de média | 50051 | gRPC |
| Serviço de anomalias | 50052 | gRPC |

### Tecnologias

- TypeScript
- Node.js (módulos `net`, `http`, `fs`, `path`)
- gRPC (`@grpc/grpc-js` e `@grpc/proto-loader`) com Protocol Buffers
- [tsx](https://github.com/privatenumber/tsx) para execução direta dos arquivos `.ts`

### Como executar

Cada comando abaixo roda em um terminal separado, a partir da raiz do projeto. Siga esta ordem, para que cada parte encontre as anteriores já no ar.

#### 1. Serviço de média

```
npx tsx src/calculo/servidor.ts
```

#### 2. Sensores do Edge 1

```
npx tsx src/sensores2/sensor.ts 3001 S1
npx tsx src/sensores2/sensor.ts 3002 S2
npx tsx src/sensores2/sensor.ts 3003 S3
```

#### 3. Edge 1 (gateway)

```
npx tsx src/gateway/gateway.ts
```

O Edge 1 faz uma coleta ao iniciar e outra a cada clique no botão da interface. Por isso os sensores precisam estar no ar antes dele.

#### 4. Sensores do Edge 2

```
npx tsx src/sensores2/sensor.ts 3004 S4
npx tsx src/sensores2/sensor.ts 3005 S5
npx tsx src/sensores2/sensor.ts 3006 S6
```

#### 5. Edge 2 (gateway)

```
npx tsx src/gateway2/gateway2.ts
```

#### 6. Serviço de anomalias

```
npx tsx src/anomalias/servidor.ts
```

#### 7. FOG

```
npx tsx src/fog/fog.ts
```

#### 8. Interface web

Com o Edge 1 em execução, acesse:

```
http://localhost:8080
```

### Executando em máquinas diferentes

Cada componente pode rodar em uma máquina da mesma rede. O que muda é o endereço de quem consulta, definido por variáveis de ambiente (o padrão é `localhost`):

| Variável | Usada por | O que indica |
|---|---|---|
| `SENSOR1_HOST`, `SENSOR2_HOST`, `SENSOR3_HOST` | Edge 1 | IP de cada sensor |
| `SENSOR4_HOST`, `SENSOR5_HOST`, `SENSOR6_HOST` | Edge 2 | IP de cada sensor |
| `MEDIA_HOST`, `MEDIA_PORT` | Edge 1 e Edge 2 | Onde está o serviço de média |
| `EDGE1_HOST`, `EDGE2_HOST` | FOG | IP de cada Edge |
| `ANOMALIAS_HOST`, `ANOMALIAS_PORT` | FOG | Onde está o serviço de anomalias |

Exemplo no PowerShell, na máquina do Edge 1:

```powershell
$env:SENSOR1_HOST="192.168.0.10"
$env:SENSOR2_HOST="192.168.0.11"
$env:SENSOR3_HOST="192.168.0.12"
$env:MEDIA_HOST="192.168.0.20"
npx tsx src/gateway/gateway.ts
```


### Estrutura do projeto

```
src/
├── sensores2/
│   └── sensor.ts                # Sensor TCP individual (S1 a S6)
├── gateway/
│   └── gateway.ts               # Edge 1: coleta S1-S3, serve a interface web
├── gateway2/
│   └── gateway2.ts              # Edge 2: coleta S4-S6
├── calculo/
│   ├── calcularMedia.proto      # Contrato gRPC do serviço de média
│   ├── servidor.ts              # Serviço de média
│   └── testeCliente.ts          # Cliente de teste do serviço de média
├── anomalias/
│   ├── analiseAnomalias.proto   # Contrato gRPC do serviço de anomalias
│   └── servidor.ts              # Serviço de anomalias
├── fog/
│   └── fog.ts                   # FOG: consulta os Edges e aciona gatilhos
├── modelos/
│   └── leituraSensor.ts         # Classe LeituraSensor
└── interface/
    └── index.html               # Interface web de monitoramento
```
