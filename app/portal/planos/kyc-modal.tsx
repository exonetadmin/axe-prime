'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { submitKycAndPlanAction } from './plans.actions';

// ── Helpers ───────────────────────────────────────────────────────────────────

function centsToDisplay(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
  });
}

function parseBRLInput(value: string): { display: string; raw: string } {
  const digits = value.replace(/\D/g, '').replace(/^0+/, '') || '0';
  const cents  = parseInt(digits, 10);
  return { display: centsToDisplay(cents), raw: (cents / 100).toFixed(2) };
}

function maskCPF(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length > 9) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  if (d.length > 6) return d.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
  if (d.length > 3) return d.replace(/(\d{3})(\d{1,3})/, '$1.$2');
  return d;
}

function maskCEP(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length > 5) return d.replace(/(\d{5})(\d{1,3})/, '$1-$2');
  return d;
}

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length > 6) return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  if (d.length > 2) return d.replace(/(\d{2})(\d{0,5})/, '($1) $2');
  return d;
}

function maskDate(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length > 4) return d.replace(/(\d{2})(\d{2})(\d{0,4})/, '$1/$2/$3');
  if (d.length > 2) return d.replace(/(\d{2})(\d{0,2})/, '$1/$2');
  return d;
}

type ViaCepResponse = { logradouro?: string; localidade?: string; uf?: string; erro?: boolean };

async function fetchCep(cep: string): Promise<ViaCepResponse | null> {
  try {
    const cleaned = cep.replace(/\D/g, '');
    if (cleaned.length !== 8) return null;
    const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ── Design Tokens ─────────────────────────────────────────────────────────────

const AXE = {
  bg:           '#030b13',
  surface:      'linear-gradient(180deg, rgba(10,25,38,0.92), rgba(3,11,19,0.88))',
  border:       'rgba(56,189,248,0.18)',
  borderFocus:  'rgba(56,189,248,0.55)',
  accent:       '#38bdf8',
  accentDim:    'rgba(56,189,248,0.12)',
  inputBg:      'rgba(4,18,30,0.75)',
  textPrimary:  '#f0f8ff',
  textMuted:    '#7ba5c0',
  textSoft:     '#4a7a96',
  errorColor:   '#f87171',
  blur:         'blur(18px)',
};

// ── Component ─────────────────────────────────────────────────────────────────

type KycModalProps = {
  onClose: () => void;
  userEmail?: string;
  userPhone?: string;
  /** When true, the modal cannot be closed (no ✕ button). Used for mandatory onboarding. */
  mandatory?: boolean;
};

export default function KycModal({ onClose, userEmail, userPhone, mandatory = false }: KycModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'start' | 'prime' | 'elite'>('start');

  // BRL display
  const [displayIncome, setDisplayIncome] = useState('');
  const [displayPatrimony, setDisplayPatrimony] = useState('');
  const [displayInvestment, setDisplayInvestment] = useState('');

  const [form, setForm] = useState({
    full_name: '',
    cpf: '',
    rg: '',
    rg_issue_date: '',
    rg_issuer: '',
    birth_date: '',
    birth_state: '',
    birth_city: '',
    father_name: '',
    mother_name: '',
    profession: '',
    monthly_income: '',
    patrimony: '',
    address_cep: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    address_city: '',
    address_state: '',
    phone: userPhone ?? '',
    email: userEmail ?? '',
    monthly_investment: '',
    marital_status: '',
  });

  const cepTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  function update(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  // Auto-fill address from CEP
  useEffect(() => {
    const cep = form.address_cep.replace(/\D/g, '');
    if (cep.length < 8) return;
    clearTimeout(cepTimeout.current);
    cepTimeout.current = setTimeout(async () => {
      setCepLoading(true);
      const data = await fetchCep(cep);
      setCepLoading(false);
      if (data && !data.erro) {
        setForm(prev => ({
          ...prev,
          address_street: data.logradouro ?? prev.address_street,
          address_city: data.localidade ?? prev.address_city,
          address_state: data.uf ?? prev.address_state,
        }));
      }
    }, 600);
    return () => clearTimeout(cepTimeout.current);
  }, [form.address_cep]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.set(k, v));
    fd.set('requested_plan', selectedPlan);
    startTransition(async () => {
      const res = await submitKycAndPlanAction(fd);
      if (res.error) setError(res.error);
      else onClose();
    });
  }

  // ── Styles ──────────────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%', background: AXE.inputBg,
    border: `1px solid ${AXE.border}`, borderRadius: '0.5rem',
    padding: '0.6rem 0.875rem', fontSize: '0.82rem',
    color: AXE.textPrimary, outline: 'none', boxSizing: 'border-box',
    backdropFilter: AXE.blur, transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.62rem', color: AXE.textMuted,
    marginBottom: '0.25rem', textTransform: 'uppercase',
    letterSpacing: '0.08em', fontWeight: 600,
  };

  const rowStyle: React.CSSProperties = { marginBottom: '0.75rem' };

  const gridRow = (cols: string): React.CSSProperties => ({
    display: 'grid', gridTemplateColumns: cols, gap: '0.625rem', marginBottom: '0.75rem',
  });

  const sectionTitle = (text: string) => (
    <div style={{
      fontSize: '0.6rem', fontWeight: 700, color: AXE.accent,
      textTransform: 'uppercase', letterSpacing: '0.12em',
      marginBottom: '0.625rem', marginTop: '0.375rem',
      padding: '0.375rem 0', borderBottom: `1px solid ${AXE.border}`,
      display: 'flex', alignItems: 'center', gap: '0.35rem',
    }}>
      <span style={{ width: 14, height: 1, background: AXE.accent, display: 'inline-block' }} />
      {text}
    </div>
  );

  const planColors = { start: '#60a5fa', prime: '#38bdf8', elite: '#a78bfa' };

  // Step validation
  const step1Valid = form.full_name && form.cpf.replace(/\D/g, '').length === 11 && form.rg && form.rg_issue_date && form.rg_issuer && form.birth_date && form.marital_status;
  const step2Valid = form.profession && form.monthly_income && form.patrimony && form.phone && form.email;

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(3,11,19,0.88)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}>
        <div style={{
          background: AXE.surface,
          border: `1px solid ${AXE.border}`,
          borderTop: `1px solid rgba(125,211,252,0.28)`,
          borderRadius: '1.25rem',
          width: '100%', maxWidth: '540px',
          maxHeight: '90vh', overflowY: 'auto',
          padding: '1.75rem 1.75rem 1.5rem',
          position: 'relative',
          backdropFilter: AXE.blur, WebkitBackdropFilter: AXE.blur,
          boxShadow: `0 0 40px rgba(56,189,248,0.08), 0 24px 64px rgba(0,0,0,0.6)`,
        }}>

          {/* Accent line */}
          <div style={{
            position: 'absolute', top: 0, left: '10%', right: '10%', height: '2px',
            background: `linear-gradient(90deg, transparent, ${AXE.accent}, transparent)`,
            borderRadius: '1px',
          }} />

          {/* Header */}
          <div style={{ marginBottom: '1.25rem', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: AXE.textPrimary, margin: 0 }}>
                  Cadastro do Plano
                </h2>
                <p style={{ fontSize: '0.72rem', color: AXE.textMuted, marginTop: '0.2rem', letterSpacing: '0.04em' }}>
                  Passo {step} de 3: {step === 1 ? 'Dados pessoais' : step === 2 ? 'Profissional e contato' : 'Endereço e plano'}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                {!mandatory && (
                  <button type="button" onClick={onClose} aria-label="Fechar" style={{
                    background: 'none', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '0.4rem', color: AXE.textMuted, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '1.75rem', height: '1.75rem', fontSize: '1rem',
                    lineHeight: 1, transition: 'color 0.2s, border-color 0.2s',
                  }}>✕</button>
                )}
                <div style={{ display: 'flex', gap: '3px' }}>
                  {[1,2,3].map(s => (
                    <div key={s} style={{
                      width: 24, height: 3, borderRadius: 2,
                      background: step >= s ? AXE.accent : AXE.border,
                      boxShadow: step >= s ? `0 0 6px ${AXE.accent}` : 'none',
                      transition: 'all 0.3s',
                    }} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>

            {/* ── STEP 1: Dados Pessoais ── */}
            {step === 1 && (
              <div>
                {sectionTitle('Identificação')}

                <div style={rowStyle}>
                  <label style={labelStyle}>Nome Completo *</label>
                  <input type="text" required placeholder="Nome completo conforme documento"
                    value={form.full_name} onChange={e => update('full_name', e.target.value)}
                    style={inputStyle} />
                </div>

                <div style={gridRow('1fr 1fr')}>
                  <div>
                    <label style={labelStyle}>CPF *</label>
                    <input type="text" required inputMode="numeric" placeholder="000.000.000-00"
                      maxLength={14} value={form.cpf}
                      onChange={e => update('cpf', maskCPF(e.target.value))}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>RG *</label>
                    <input type="text" required placeholder="Número do RG"
                      value={form.rg} onChange={e => update('rg', e.target.value)}
                      style={inputStyle} />
                  </div>
                </div>

                <div style={gridRow('1fr 1fr')}>
                  <div>
                    <label style={labelStyle}>Data de Emissão *</label>
                    <input type="text" required inputMode="numeric" placeholder="DD/MM/AAAA"
                      maxLength={10} value={form.rg_issue_date}
                      onChange={e => update('rg_issue_date', maskDate(e.target.value))}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Órgão Emissor *</label>
                    <input type="text" required placeholder="SSP/SP"
                      value={form.rg_issuer}
                      onChange={e => update('rg_issuer', e.target.value.toUpperCase())}
                      style={inputStyle} />
                  </div>
                </div>

                {sectionTitle('Nascimento')}

                <div style={rowStyle}>
                  <label style={labelStyle}>Data de Nascimento *</label>
                  <input type="text" required inputMode="numeric" placeholder="DD/MM/AAAA"
                    maxLength={10} value={form.birth_date}
                    onChange={e => update('birth_date', maskDate(e.target.value))}
                    style={inputStyle} />
                </div>

                <div style={gridRow('1fr 1fr')}>
                  <div>
                    <label style={labelStyle}>UF Naturalidade</label>
                    <input type="text" placeholder="SP" maxLength={2}
                      value={form.birth_state}
                      onChange={e => update('birth_state', e.target.value.toUpperCase())}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Naturalidade Cidade</label>
                    <input type="text" placeholder="São Paulo"
                      value={form.birth_city}
                      onChange={e => update('birth_city', e.target.value)}
                      style={inputStyle} />
                  </div>
                </div>

                {sectionTitle('Estado Civil')}

                <div style={rowStyle}>
                  <label style={labelStyle}>Estado Civil *</label>
                  <select
                    required
                    value={form.marital_status}
                    onChange={e => update('marital_status', e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237ba5c0' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center' }}
                  >
                    <option value="" disabled>Selecione...</option>
                    <option value="solteiro">Solteiro(a)</option>
                    <option value="casado">Casado(a)</option>
                    <option value="divorciado">Divorciado(a)</option>
                    <option value="viuvo">Viúvo(a)</option>
                    <option value="separado">Separado(a)</option>
                    <option value="uniao_estavel">União Estável</option>
                  </select>
                </div>

                {sectionTitle('Filiação')}

                <div style={gridRow('1fr 1fr')}>
                  <div>
                    <label style={labelStyle}>Nome do Pai</label>
                    <input type="text" placeholder="Nome completo"
                      value={form.father_name}
                      onChange={e => update('father_name', e.target.value)}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Nome da Mãe</label>
                    <input type="text" placeholder="Nome completo"
                      value={form.mother_name}
                      onChange={e => update('mother_name', e.target.value)}
                      style={inputStyle} />
                  </div>
                </div>

                <button type="button" onClick={() => setStep(2)}
                  disabled={!step1Valid}
                  style={{
                    width: '100%', marginTop: '0.5rem',
                    background: !step1Valid ? AXE.accentDim : 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
                    color: !step1Valid ? AXE.textSoft : '#030b13',
                    border: `1px solid ${AXE.borderFocus}`, borderRadius: '0.5rem',
                    padding: '0.8rem', fontWeight: 700, fontSize: '0.85rem',
                    cursor: !step1Valid ? 'not-allowed' : 'pointer',
                    letterSpacing: '0.04em', transition: 'all 0.2s',
                    boxShadow: !step1Valid ? 'none' : '0 0 16px rgba(56,189,248,0.3)',
                  }}>
                  Continuar →
                </button>
              </div>
            )}

            {/* ── STEP 2: Profissional e Contato ── */}
            {step === 2 && (
              <div>
                {sectionTitle('Profissional')}

                <div style={rowStyle}>
                  <label style={labelStyle}>Profissão *</label>
                  <input type="text" required placeholder="Ex: Empresário, Autônomo..."
                    value={form.profession} onChange={e => update('profession', e.target.value)}
                    style={inputStyle} />
                </div>

                <div style={gridRow('1fr 1fr')}>
                  <div>
                    <label style={labelStyle}>Renda Mensal (R$) *</label>
                    <input type="text" inputMode="numeric" required placeholder="R$ 0,00"
                      value={displayIncome}
                      onChange={e => {
                        const { display, raw } = parseBRLInput(e.target.value);
                        setDisplayIncome(display);
                        update('monthly_income', raw);
                      }}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Valor do Patrimônio (R$) *</label>
                    <input type="text" inputMode="numeric" required placeholder="R$ 0,00"
                      value={displayPatrimony}
                      onChange={e => {
                        const { display, raw } = parseBRLInput(e.target.value);
                        setDisplayPatrimony(display);
                        update('patrimony', raw);
                      }}
                      style={inputStyle} />
                  </div>
                </div>

                {sectionTitle('Contato')}

                <div style={gridRow('1fr 1fr')}>
                  <div>
                    <label style={labelStyle}>Celular *</label>
                    <input type="tel" required placeholder="(11) 99999-9999"
                      maxLength={15} value={form.phone}
                      onChange={e => update('phone', maskPhone(e.target.value))}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>E-mail *</label>
                    <input type="email" required placeholder="seu@email.com"
                      value={form.email}
                      onChange={e => update('email', e.target.value)}
                      style={inputStyle} />
                  </div>
                </div>

                {sectionTitle('Plano de Investimento')}

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={labelStyle}>Plano de interesse *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                    {(['start', 'prime', 'elite'] as const).map(p => {
                      const color = planColors[p];
                      const sel = selectedPlan === p;
                      return (
                        <button key={p} type="button" onClick={() => setSelectedPlan(p)} style={{
                          padding: '0.65rem 0.5rem', borderRadius: '0.625rem',
                          border: `1.5px solid ${sel ? color : AXE.border}`,
                          background: sel ? `${color}18` : AXE.inputBg,
                          color: sel ? color : AXE.textMuted,
                          fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                          textTransform: 'uppercase', letterSpacing: '0.08em',
                          transition: 'all 0.2s',
                          boxShadow: sel ? `0 0 10px ${color}30` : 'none',
                        }}>{p}</button>
                      );
                    })}
                  </div>
                </div>

                <div style={rowStyle}>
                  <label style={labelStyle}>Aporte mensal pretendido (R$) *</label>
                  <input type="text" inputMode="numeric" required placeholder="R$ 0,00"
                    value={displayInvestment}
                    onChange={e => {
                      const { display, raw } = parseBRLInput(e.target.value);
                      setDisplayInvestment(display);
                      update('monthly_investment', raw);
                    }}
                    style={inputStyle} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.625rem', marginTop: '0.25rem' }}>
                  <button type="button" onClick={() => setStep(1)} style={{
                    background: 'transparent', border: `1px solid ${AXE.border}`,
                    borderRadius: '0.5rem', padding: '0.8rem', fontWeight: 600,
                    fontSize: '0.85rem', cursor: 'pointer', color: AXE.textMuted,
                    transition: 'all 0.2s',
                  }}>← Voltar</button>
                  <button type="button" onClick={() => setStep(3)}
                    disabled={!step2Valid || !form.monthly_investment}
                    style={{
                      background: (!step2Valid || !form.monthly_investment) ? AXE.accentDim : 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
                      color: (!step2Valid || !form.monthly_investment) ? AXE.textSoft : '#030b13',
                      border: `1px solid ${AXE.borderFocus}`, borderRadius: '0.5rem',
                      padding: '0.8rem', fontWeight: 700, fontSize: '0.85rem',
                      cursor: (!step2Valid || !form.monthly_investment) ? 'not-allowed' : 'pointer',
                      letterSpacing: '0.04em', transition: 'all 0.2s',
                      boxShadow: (!step2Valid || !form.monthly_investment) ? 'none' : '0 0 16px rgba(56,189,248,0.3)',
                    }}>
                    Continuar →
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Endereço ── */}
            {step === 3 && (
              <div>
                {sectionTitle('Endereço')}

                <div style={gridRow('1fr 1fr')}>
                  <div>
                    <label style={labelStyle}>
                      CEP * {cepLoading && <span style={{ color: AXE.accent }}>(buscando...)</span>}
                    </label>
                    <input type="text" required placeholder="00000-000" maxLength={9}
                      value={form.address_cep}
                      onChange={e => update('address_cep', maskCEP(e.target.value))}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>UF *</label>
                    <input type="text" required maxLength={2}
                      value={form.address_state}
                      onChange={e => update('address_state', e.target.value.toUpperCase())}
                      style={inputStyle} />
                  </div>
                </div>

                <div style={rowStyle}>
                  <label style={labelStyle}>Rua / Logradouro *</label>
                  <input type="text" required placeholder="Preenchido automaticamente"
                    value={form.address_street}
                    onChange={e => update('address_street', e.target.value)}
                    style={inputStyle} />
                </div>

                <div style={gridRow('1fr 1fr')}>
                  <div>
                    <label style={labelStyle}>Número *</label>
                    <input type="text" required value={form.address_number}
                      onChange={e => update('address_number', e.target.value)}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Complemento</label>
                    <input type="text" value={form.address_complement}
                      onChange={e => update('address_complement', e.target.value)}
                      style={inputStyle} />
                  </div>
                </div>

                <div style={rowStyle}>
                  <label style={labelStyle}>Cidade *</label>
                  <input type="text" required value={form.address_city}
                    onChange={e => update('address_city', e.target.value)}
                    style={inputStyle} />
                </div>

                {error && (
                  <p style={{ color: AXE.errorColor, fontSize: '0.8rem', marginBottom: '0.75rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    ⚠️ {error}
                  </p>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.625rem' }}>
                  <button type="button" onClick={() => setStep(2)} style={{
                    background: 'transparent', border: `1px solid ${AXE.border}`,
                    borderRadius: '0.5rem', padding: '0.8rem', fontWeight: 600,
                    fontSize: '0.85rem', cursor: 'pointer', color: AXE.textMuted,
                    transition: 'all 0.2s',
                  }}>← Voltar</button>
                  <button type="submit" disabled={isPending} style={{
                    background: isPending ? AXE.accentDim : 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
                    color: isPending ? AXE.textSoft : '#030b13',
                    border: `1px solid ${AXE.borderFocus}`, borderRadius: '0.5rem',
                    padding: '0.8rem', fontWeight: 700, fontSize: '0.85rem',
                    cursor: isPending ? 'not-allowed' : 'pointer',
                    letterSpacing: '0.04em', opacity: isPending ? 0.7 : 1,
                    transition: 'all 0.2s',
                    boxShadow: isPending ? 'none' : '0 0 16px rgba(56,189,248,0.3)',
                  }}>{isPending ? 'Enviando...' : '✓ Salvar cadastro'}</button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </>
  );
}
