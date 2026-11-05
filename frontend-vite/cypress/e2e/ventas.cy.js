/* eslint-disable no-undef */
/// <reference types="cypress" />

describe('Prueba del Sistema POS', () => {
  it('Carga correctamente el Punto de Venta en Producción', () => {
    // Visita tu enlace real de Vercel
    cy.visit('https://proyecto-gestion-de-ventas-intelige.vercel.app/');
    
    // Verifica que el login o el sistema cargue correctamente
    cy.contains('Bodega').should('exist'); // Ajusta la palabra si es necesario
  });
});