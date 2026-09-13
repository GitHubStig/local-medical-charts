/**
 * The Plotly calls this app makes. plotly.js-basic-dist-min ships without
 * types, and @types/plotly.js would add a package for three functions.
 */
declare module "plotly.js-basic-dist-min" {
  type PlotElement = HTMLElement & {
    on(event: string, handler: (event: never) => void): void;
  };

  const Plotly: {
    newPlot(
      element: HTMLElement,
      data: object[],
      layout: object,
      config: object,
    ): Promise<PlotElement>;
    purge(element: HTMLElement): void;
  };

  export default Plotly;
}
