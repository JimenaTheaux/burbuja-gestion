import { RepartidorView } from '@/components/repartidor/RepartidorView'
import { AvisoFallidas }  from '@/components/repartidor/AvisoFallidas'
import { useOffline }     from '@/hooks/useOffline'

export default function RepartidorPage() {
  // AdminLayout no tiene los banners offline de RepartidorLayout: el aviso de
  // acciones rechazadas va acá para que el admin también lo vea.
  const { fallidas, descartar } = useOffline()
  return (
    <>
      <AvisoFallidas fallidas={fallidas} onDescartar={descartar} />
      <RepartidorView />
    </>
  )
}
