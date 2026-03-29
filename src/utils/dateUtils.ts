import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatarData(timestamp: number): string {
  return format(new Date(timestamp), "dd/MM/yyyy", { locale: ptBR });
}

export function formatarDataHora(timestamp: number): string {
  return format(new Date(timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatarHora(timestamp: number): string {
  return format(new Date(timestamp), "HH:mm", { locale: ptBR });
}

export function tempoRelativo(timestamp: number): string {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: ptBR });
}

export function hojeString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function diaSemanaLabel(dia: number): string {
  const nomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return nomes[dia] || '';
}
