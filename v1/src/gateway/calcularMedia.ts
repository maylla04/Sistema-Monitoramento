import { LeituraSensor } from "../modelos/leituraSensor.js";

export function calcularMedias(leituras: LeituraSensor[]) {
  const temperaturaMedia =
    leituras.reduce((soma, leitura) => soma + leitura.temperatura, 0) /
    leituras.length;

  const umidadeMedia =
    leituras.reduce((soma, leitura) => soma + leitura.umidade, 0) /
    leituras.length;

  const incidenciaSolarMedia =
    leituras.reduce((soma, leitura) => soma + leitura.incidenciaSolar, 0) /
    leituras.length;

  console.log("Médias calculadas:");
  console.log(`Temperatura: ${Math.round(temperaturaMedia)}°C`);
  console.log(`Umidade: ${Math.round(umidadeMedia)}%`);
  console.log(`Solar: ${Math.round(incidenciaSolarMedia)} W/m²`);

  return {
    temperaturaMedia: Math.round(temperaturaMedia),
    umidadeMedia: Math.round(umidadeMedia),
    incidenciaSolarMedia: Math.round(incidenciaSolarMedia),
  };
}
