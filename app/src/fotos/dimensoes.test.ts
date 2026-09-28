/// <reference types="jest" />
import { redimensionamento } from './dimensoes';

describe('redimensionamento', () => {
  it('limita o lado maior', () => {
    expect(redimensionamento(4000, 3000, 1024)).toEqual({ width: 1024 });
    expect(redimensionamento(3000, 4000, 1024)).toEqual({ height: 1024 });
    expect(redimensionamento(2000, 2000, 320)).toEqual({ width: 320 });
  });

  it('não amplia foto menor que o limite', () => {
    expect(redimensionamento(800, 600, 1024)).toEqual({ width: 800 });
    expect(redimensionamento(200, 300, 320)).toEqual({ height: 300 });
  });
});
