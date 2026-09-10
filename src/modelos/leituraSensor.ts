class LeituraSensor {
  sensor: string;
  temperatura: number;
  umidade: number;
  incidenciaSolar: number;
  data: string;

  constructor(
    sensor: string,
    temperatura: number,
    umidade: number,
    incidenciaSolar: number,
  ) {
    this.sensor = sensor;
    this.temperatura = temperatura;
    this.umidade = umidade;
    this.incidenciaSolar = incidenciaSolar;
    this.data = new Date().toLocaleString("pt-BR");
  }
}

export { LeituraSensor };
