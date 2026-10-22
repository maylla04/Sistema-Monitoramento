import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import * as path from "path";

const caminhoProto = path.join(
  process.cwd(),
  "src",
  "calculo",
  "calcularMedia.proto",
);

const definicao = protoLoader.loadSync(caminhoProto, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const pacote = grpc.loadPackageDefinition(definicao) as any;
const cliente = new pacote.calculo.CalculoService(
  "localhost:50051",
  grpc.credentials.createInsecure(),
);

const leituras = {
  leituras: [
    { temperatura: 20, umidade: 40, incidenciaSolar: 300 },
    { temperatura: 30, umidade: 60, incidenciaSolar: 500 },
  ],
};

cliente.calcularMedias(leituras, (erro: any, resposta: any) => {
  if (erro) {
    console.error("Erro na chamada RPC:", erro.message);
    cliente.close();
    return;
  }

  console.log("Resposta recebida do servidor RPC:");
  console.log(resposta);

  cliente.close();
});
