import { CircleAlert, Clock3, Link2Off } from 'lucide-react'
import type { PublicUnavailableReason } from '../types/simulation'

const messages: Record<PublicUnavailableReason, { title: string; body: string; icon: typeof CircleAlert }> = {
  not_found: {
    title: 'הקישור אינו תקין',
    body: 'לא מצאנו סימולציה בכתובת הזו. כדאי לבדוק שהקישור הועתק במלואו או לפנות למנחה.',
    icon: CircleAlert,
  },
  draft: {
    title: 'הסימולציה עדיין בהכנה',
    body: 'המנחה עדיין לא פרסם את הסימולציה. אפשר לנסות שוב לאחר קבלת עדכון.',
    icon: Clock3,
  },
  unpublished: {
    title: 'הקישור אינו פעיל כרגע',
    body: 'פרסום הסימולציה בוטל. לקבלת קישור פעיל יש לפנות למנחה.',
    icon: Link2Off,
  },
  deleted: {
    title: 'הסימולציה אינה זמינה עוד',
    body: 'הסימולציה שהייתה מקושרת לכתובת הזו נמחקה. אפשר לפנות למנחה לקבלת מידע נוסף.',
    icon: Link2Off,
  },
  replaced: {
    title: 'נוצר קישור חדש לסימולציה',
    body: 'הקישור הזה הוחלף ואינו פעיל עוד. בקשו מהמנחה את הקישור העדכני.',
    icon: Link2Off,
  },
}

export function PublicUnavailableState({ reason }: { reason: PublicUnavailableReason }) {
  const message = messages[reason]
  const Icon = message.icon
  return (
    <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-[#dce5e1] bg-white p-8 text-center shadow-card sm:p-12">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf3f0] text-forest"><Icon className="h-7 w-7" aria-hidden="true" /></span>
      <h1 className="mt-5 text-2xl font-bold text-ink">{message.title}</h1>
      <p className="mt-3 leading-7 text-[#5b726c]">{message.body}</p>
    </div>
  )
}
