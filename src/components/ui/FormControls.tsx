import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

interface CommonProps {
  label: string
  hint?: string
  required?: boolean
}

export function TextField({ label, hint, required, className = '', ...props }: CommonProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = props.id ?? props.name
  return (
    <label className={`form-control ${className}`} htmlFor={id}>
      <span className="form-label">{label}{required && <span className="required-mark"> *</span>}</span>
      {hint && <span className="form-hint">{hint}</span>}
      <input id={id} required={required} className="text-input" {...props} />
    </label>
  )
}

export function TextareaField({ label, hint, required, className = '', rows = 4, ...props }: CommonProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = props.id ?? props.name
  return (
    <label className={`form-control ${className}`} htmlFor={id}>
      <span className="form-label">{label}{required && <span className="required-mark"> *</span>}</span>
      {hint && <span className="form-hint">{hint}</span>}
      <textarea id={id} required={required} rows={rows} className="text-input resize-y" {...props} />
    </label>
  )
}

export function SelectField({ label, hint, required, children, className = '', ...props }: CommonProps & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const id = props.id ?? props.name
  return (
    <label className={`form-control ${className}`} htmlFor={id}>
      <span className="form-label">{label}{required && <span className="required-mark"> *</span>}</span>
      {hint && <span className="form-hint">{hint}</span>}
      <select id={id} required={required} className="text-input" {...props}>{children}</select>
    </label>
  )
}

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-lg border border-[#e5e4e7] bg-white p-4 shadow-sm ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-5 w-5 rounded border-[#949494] text-forest focus:ring-[#ec2a8c]"
      />
      <span>
        <span className="block text-sm font-bold text-ink">{label}</span>
        {description && <span className="mt-1 block text-sm leading-6 text-[#5a5a5c]">{description}</span>}
      </span>
    </label>
  )
}
