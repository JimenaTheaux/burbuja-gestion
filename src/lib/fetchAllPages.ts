// PostgREST corta cada SELECT en 1000 filas (db-max-rows de Supabase): una
// consulta que crece por encima de eso se trunca sin aviso. Este helper pide
// páginas con .range() hasta que una vuelve incompleta. (Mismo helper que Tropa.)
//
// La query tiene que tener un orden total (terminar en .order('id')) — con un
// orden con empates las filas en el borde de una página pueden repetirse o saltearse.
const PAGE_SIZE = 1000

interface PageResult<T> {
  data: T[] | null
  error: { message: string } | null
}

export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<{ data: T[]; error: string | null }> {
  const filas: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) return { data: filas, error: error.message }
    const pagina = data ?? []
    filas.push(...pagina)
    if (pagina.length < PAGE_SIZE) return { data: filas, error: null }
  }
}
