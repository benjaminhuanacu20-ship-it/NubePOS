import {
  addProductStock,
  createAlert,
  createPromotion,
  markRecommendationAccepted,
} from '@/lib/db'
import type { Recommendation } from '@/types/models'

export async function executeRecommendation(companyId: string, recommendation: Recommendation) {
  const { metadata } = recommendation

  switch (recommendation.actionType) {
    case 'create_promotion': {
      const discountPct = metadata.discountPct ?? 15
      await createPromotion(companyId, {
        productId: metadata.productId ?? null,
        discountPct,
        description: recommendation.title,
      })
      await markRecommendationAccepted(recommendation.id)
      return `Promoción creada: ${discountPct}% de descuento en ${metadata.productName ?? 'el producto'}.`
    }

    case 'buy_stock': {
      const quantity = metadata.quantity ?? 10
      if (metadata.productId) {
        await addProductStock(metadata.productId, quantity)
      }
      await createAlert(companyId, {
        type: 'compra',
        title: 'Orden de compra ejecutada',
        message: `Se añadieron ${quantity} unidades de ${metadata.productName ?? 'producto'} al inventario.`,
        status: 'resolved',
      })
      await markRecommendationAccepted(recommendation.id)
      return `Inventario actualizado: +${quantity} unidades de ${metadata.productName ?? 'el producto'}.`
    }

    case 'contact_customer': {
      await createAlert(companyId, {
        type: 'cliente',
        title: 'Contacto programado',
        message: `Contactar a ${metadata.customerName ?? 'cliente'}: ${recommendation.message}`,
        status: 'resolved',
      })
      await markRecommendationAccepted(recommendation.id)
      return `Contacto programado con ${metadata.customerName ?? 'el cliente'}.`
    }

    default: {
      await markRecommendationAccepted(recommendation.id)
      return 'Recomendación aceptada.'
    }
  }
}
