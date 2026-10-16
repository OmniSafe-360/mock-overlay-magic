export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      caixa_sangrias: {
        Row: {
          comercio_id: string
          criado_em: string
          funcionario_id: string
          id: string
          motivo: string | null
          turno_id: string
          valor: number
        }
        Insert: {
          comercio_id: string
          criado_em?: string
          funcionario_id: string
          id: string
          motivo?: string | null
          turno_id: string
          valor: number
        }
        Update: {
          comercio_id?: string
          criado_em?: string
          funcionario_id?: string
          id?: string
          motivo?: string | null
          turno_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "caixa_sangrias_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caixa_sangrias_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caixa_sangrias_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "caixa_turnos"
            referencedColumns: ["id"]
          },
        ]
      }
      caixa_turnos: {
        Row: {
          aberto_em: string
          caixa_id: string
          comercio_id: string
          conferido_em: string | null
          diferenca: number | null
          dinheiro_contado: number | null
          dinheiro_esperado: number | null
          fechado_em: string | null
          funcionario_id: string
          id: string
          observacao: string | null
          situacao: string
          troco_inicial: number
        }
        Insert: {
          aberto_em?: string
          caixa_id: string
          comercio_id: string
          conferido_em?: string | null
          diferenca?: number | null
          dinheiro_contado?: number | null
          dinheiro_esperado?: number | null
          fechado_em?: string | null
          funcionario_id: string
          id: string
          observacao?: string | null
          situacao?: string
          troco_inicial: number
        }
        Update: {
          aberto_em?: string
          caixa_id?: string
          comercio_id?: string
          conferido_em?: string | null
          diferenca?: number | null
          dinheiro_contado?: number | null
          dinheiro_esperado?: number | null
          fechado_em?: string | null
          funcionario_id?: string
          id?: string
          observacao?: string | null
          situacao?: string
          troco_inicial?: number
        }
        Relationships: [
          {
            foreignKeyName: "caixa_turnos_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caixa_turnos_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caixa_turnos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      caixas: {
        Row: {
          aparelho: string | null
          chave_hash: string | null
          codigo: string | null
          codigo_gerado_em: string | null
          comercio_id: string
          created_at: string
          desligado_em: string | null
          funcionario_id: string | null
          id: string
          ligado_em: string | null
          nome: string
          tipo: string
          ultima_venda_em: string | null
          ultimo_contato_em: string | null
        }
        Insert: {
          aparelho?: string | null
          chave_hash?: string | null
          codigo?: string | null
          codigo_gerado_em?: string | null
          comercio_id: string
          created_at?: string
          desligado_em?: string | null
          funcionario_id?: string | null
          id?: string
          ligado_em?: string | null
          nome: string
          tipo?: string
          ultima_venda_em?: string | null
          ultimo_contato_em?: string | null
        }
        Update: {
          aparelho?: string | null
          chave_hash?: string | null
          codigo?: string | null
          codigo_gerado_em?: string | null
          comercio_id?: string
          created_at?: string
          desligado_em?: string | null
          funcionario_id?: string | null
          id?: string
          ligado_em?: string | null
          nome?: string
          tipo?: string
          ultima_venda_em?: string | null
          ultimo_contato_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caixas_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caixas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_produtos: {
        Row: {
          atualizado_em: string
          codigo: string
          fonte: string
          imagem_url: string | null
          marca: string | null
          nome: string
          quantidade: string | null
        }
        Insert: {
          atualizado_em?: string
          codigo: string
          fonte?: string
          imagem_url?: string | null
          marca?: string | null
          nome: string
          quantidade?: string | null
        }
        Update: {
          atualizado_em?: string
          codigo?: string
          fonte?: string
          imagem_url?: string | null
          marca?: string | null
          nome?: string
          quantidade?: string | null
        }
        Relationships: []
      }
      clientes_fiado: {
        Row: {
          ativo: boolean
          bloqueado: boolean
          comercio_id: string
          created_at: string
          criado_por_funcionario: string | null
          id: string
          limite: number | null
          nome: string
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          bloqueado?: boolean
          comercio_id: string
          created_at?: string
          criado_por_funcionario?: string | null
          id: string
          limite?: number | null
          nome: string
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          bloqueado?: boolean
          comercio_id?: string
          created_at?: string
          criado_por_funcionario?: string | null
          id?: string
          limite?: number | null
          nome?: string
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_fiado_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_fiado_criado_por_funcionario_fkey"
            columns: ["criado_por_funcionario"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      codigos_barras: {
        Row: {
          codigo: string
          comercio_id: string
          ean_upc_mercado: string | null
          embalagem_id: string | null
          produto_id: string
          variacao_id: string | null
        }
        Insert: {
          codigo: string
          comercio_id: string
          ean_upc_mercado?: string | null
          embalagem_id?: string | null
          produto_id: string
          variacao_id?: string | null
        }
        Update: {
          codigo?: string
          comercio_id?: string
          ean_upc_mercado?: string | null
          embalagem_id?: string | null
          produto_id?: string
          variacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "codigos_barras_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      codigos_pdv: {
        Row: {
          codigo: string
          comercio_id: string
          criado_em: string
          criado_por: string
          embalagem_id: string | null
          ignorar: boolean
          produto_id: string | null
          variacao_id: string | null
        }
        Insert: {
          codigo: string
          comercio_id: string
          criado_em?: string
          criado_por: string
          embalagem_id?: string | null
          ignorar?: boolean
          produto_id?: string | null
          variacao_id?: string | null
        }
        Update: {
          codigo?: string
          comercio_id?: string
          criado_em?: string
          criado_por?: string
          embalagem_id?: string | null
          ignorar?: boolean
          produto_id?: string | null
          variacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "codigos_pdv_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "codigos_pdv_embalagem_id_fkey"
            columns: ["embalagem_id"]
            isOneToOne: false
            referencedRelation: "produto_embalagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "codigos_pdv_produto_id_comercio_id_fkey"
            columns: ["produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id", "comercio_id"]
          },
          {
            foreignKeyName: "codigos_pdv_variacao_id_produto_id_comercio_id_fkey"
            columns: ["variacao_id", "produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produto_variacoes"
            referencedColumns: ["id", "produto_id", "comercio_id"]
          },
        ]
      }
      comercios: {
        Row: {
          ativo: boolean
          bairro: string
          cep: string
          cidade: string
          complemento: string | null
          created_at: string
          documento: string
          documento_tipo: string
          dono_id: string
          id: string
          limite_faltas_mes: number
          nome: string
          numero: string | null
          proximo_codigo_interno: number
          proximo_numero_pedido: number
          proximo_numero_venda: number
          rua: string
          sem_numero: boolean
          telefone: string
          telefone_whatsapp: boolean
          tipo: Database["public"]["Enums"]["tipo_comercio"]
          uf: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bairro: string
          cep: string
          cidade: string
          complemento?: string | null
          created_at?: string
          documento: string
          documento_tipo: string
          dono_id: string
          id?: string
          limite_faltas_mes?: number
          nome: string
          numero?: string | null
          proximo_codigo_interno?: number
          proximo_numero_pedido?: number
          proximo_numero_venda?: number
          rua: string
          sem_numero?: boolean
          telefone: string
          telefone_whatsapp?: boolean
          tipo: Database["public"]["Enums"]["tipo_comercio"]
          uf: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string
          cep?: string
          cidade?: string
          complemento?: string | null
          created_at?: string
          documento?: string
          documento_tipo?: string
          dono_id?: string
          id?: string
          limite_faltas_mes?: number
          nome?: string
          numero?: string | null
          proximo_codigo_interno?: number
          proximo_numero_pedido?: number
          proximo_numero_venda?: number
          rua?: string
          sem_numero?: boolean
          telefone?: string
          telefone_whatsapp?: boolean
          tipo?: Database["public"]["Enums"]["tipo_comercio"]
          uf?: string
          updated_at?: string
        }
        Relationships: []
      }
      conferencias: {
        Row: {
          area: Database["public"]["Enums"]["area_estoque"]
          comercio_id: string
          concluida_em: string | null
          contado: number | null
          created_at: string
          diferenca_id: string | null
          esperado: number | null
          funcionario_id: string
          id: string
          operacao_id: string | null
          produto_id: string
          situacao: string
          tentativas: Json
          variacao_id: string | null
        }
        Insert: {
          area?: Database["public"]["Enums"]["area_estoque"]
          comercio_id: string
          concluida_em?: string | null
          contado?: number | null
          created_at?: string
          diferenca_id?: string | null
          esperado?: number | null
          funcionario_id: string
          id: string
          operacao_id?: string | null
          produto_id: string
          situacao?: string
          tentativas?: Json
          variacao_id?: string | null
        }
        Update: {
          area?: Database["public"]["Enums"]["area_estoque"]
          comercio_id?: string
          concluida_em?: string | null
          contado?: number | null
          created_at?: string
          diferenca_id?: string | null
          esperado?: number | null
          funcionario_id?: string
          id?: string
          operacao_id?: string | null
          produto_id?: string
          situacao?: string
          tentativas?: Json
          variacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conferencias_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conferencias_diferenca_id_fkey"
            columns: ["diferenca_id"]
            isOneToOne: false
            referencedRelation: "diferencas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conferencias_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conferencias_operacao_id_fkey"
            columns: ["operacao_id"]
            isOneToOne: false
            referencedRelation: "operacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conferencias_produto_id_comercio_id_fkey"
            columns: ["produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id", "comercio_id"]
          },
          {
            foreignKeyName: "conferencias_variacao_id_produto_id_comercio_id_fkey"
            columns: ["variacao_id", "produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produto_variacoes"
            referencedColumns: ["id", "produto_id", "comercio_id"]
          },
        ]
      }
      contagens: {
        Row: {
          area: Database["public"]["Enums"]["area_estoque"]
          comercio_id: string
          created_at: string
          criado_por: string
          id: string
          operacao_id: string
          produto_id: string
          quantidade: number
          variacao_id: string | null
        }
        Insert: {
          area: Database["public"]["Enums"]["area_estoque"]
          comercio_id: string
          created_at?: string
          criado_por: string
          id?: string
          operacao_id: string
          produto_id: string
          quantidade: number
          variacao_id?: string | null
        }
        Update: {
          area?: Database["public"]["Enums"]["area_estoque"]
          comercio_id?: string
          created_at?: string
          criado_por?: string
          id?: string
          operacao_id?: string
          produto_id?: string
          quantidade?: number
          variacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contagens_operacao_id_fkey"
            columns: ["operacao_id"]
            isOneToOne: false
            referencedRelation: "operacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contagens_produto_id_comercio_id_fkey"
            columns: ["produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id", "comercio_id"]
          },
          {
            foreignKeyName: "contagens_variacao_id_produto_id_comercio_id_fkey"
            columns: ["variacao_id", "produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produto_variacoes"
            referencedColumns: ["id", "produto_id", "comercio_id"]
          },
        ]
      }
      diferencas: {
        Row: {
          area: Database["public"]["Enums"]["area_estoque"]
          comercio_id: string
          contado: number
          created_at: string
          detalhes: Json
          diferenca: number
          esperado: number
          explicada_em: string | null
          explicada_por: string | null
          funcionario_id: string | null
          id: string
          motivo: string | null
          observacao: string | null
          origem: string
          produto_id: string
          referencia_id: string | null
          situacao: string
          valor: number
          variacao_id: string | null
        }
        Insert: {
          area: Database["public"]["Enums"]["area_estoque"]
          comercio_id: string
          contado: number
          created_at?: string
          detalhes?: Json
          diferenca: number
          esperado: number
          explicada_em?: string | null
          explicada_por?: string | null
          funcionario_id?: string | null
          id?: string
          motivo?: string | null
          observacao?: string | null
          origem: string
          produto_id: string
          referencia_id?: string | null
          situacao?: string
          valor: number
          variacao_id?: string | null
        }
        Update: {
          area?: Database["public"]["Enums"]["area_estoque"]
          comercio_id?: string
          contado?: number
          created_at?: string
          detalhes?: Json
          diferenca?: number
          esperado?: number
          explicada_em?: string | null
          explicada_por?: string | null
          funcionario_id?: string | null
          id?: string
          motivo?: string | null
          observacao?: string | null
          origem?: string
          produto_id?: string
          referencia_id?: string | null
          situacao?: string
          valor?: number
          variacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diferencas_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diferencas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diferencas_produto_id_comercio_id_fkey"
            columns: ["produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id", "comercio_id"]
          },
          {
            foreignKeyName: "diferencas_variacao_id_produto_id_comercio_id_fkey"
            columns: ["variacao_id", "produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produto_variacoes"
            referencedColumns: ["id", "produto_id", "comercio_id"]
          },
        ]
      }
      dono_pin: {
        Row: {
          criado_em: string
          dono_id: string
          pin_hash: string
          tentativas: number
          travado_ate: string | null
        }
        Insert: {
          criado_em?: string
          dono_id: string
          pin_hash: string
          tentativas?: number
          travado_ate?: string | null
        }
        Update: {
          criado_em?: string
          dono_id?: string
          pin_hash?: string
          tentativas?: number
          travado_ate?: string | null
        }
        Relationships: []
      }
      fiado_acessos: {
        Row: {
          cliente_id: string
          comercio_id: string
          created_at: string
          id: string
          pin_criado_em: string | null
          pin_hash: string | null
          sessao_ate: string | null
          sessao_hash: string | null
          tentativas: number
          token: string
          travado_ate: string | null
          ultimo_acesso: string | null
        }
        Insert: {
          cliente_id: string
          comercio_id: string
          created_at?: string
          id?: string
          pin_criado_em?: string | null
          pin_hash?: string | null
          sessao_ate?: string | null
          sessao_hash?: string | null
          tentativas?: number
          token: string
          travado_ate?: string | null
          ultimo_acesso?: string | null
        }
        Update: {
          cliente_id?: string
          comercio_id?: string
          created_at?: string
          id?: string
          pin_criado_em?: string | null
          pin_hash?: string | null
          sessao_ate?: string | null
          sessao_hash?: string | null
          tentativas?: number
          token?: string
          travado_ate?: string | null
          ultimo_acesso?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiado_acessos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes_fiado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiado_acessos_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      fiado_movimentos: {
        Row: {
          cliente_id: string
          comercio_id: string
          criado_em: string
          forma: string | null
          funcionario_id: string | null
          id: string
          observacao: string | null
          registrado_por: string | null
          tipo: string
          valor: number
          venda_id: string | null
        }
        Insert: {
          cliente_id: string
          comercio_id: string
          criado_em?: string
          forma?: string | null
          funcionario_id?: string | null
          id: string
          observacao?: string | null
          registrado_por?: string | null
          tipo: string
          valor: number
          venda_id?: string | null
        }
        Update: {
          cliente_id?: string
          comercio_id?: string
          criado_em?: string
          forma?: string | null
          funcionario_id?: string | null
          id?: string
          observacao?: string | null
          registrado_por?: string | null
          tipo?: string
          valor?: number
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiado_movimentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes_fiado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiado_movimentos_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiado_movimentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiado_movimentos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean
          created_at: string
          dono_id: string
          email: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dono_id: string
          email?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dono_id?: string
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      funcionario_aparelhos: {
        Row: {
          aparelho: string | null
          chave_hash: string
          comercio_id: string
          criado_em: string
          desbloqueado_ate: string | null
          encerrado_em: string | null
          funcionario_id: string
          id: string
          ultimo_uso: string
        }
        Insert: {
          aparelho?: string | null
          chave_hash: string
          comercio_id: string
          criado_em?: string
          desbloqueado_ate?: string | null
          encerrado_em?: string | null
          funcionario_id: string
          id?: string
          ultimo_uso?: string
        }
        Update: {
          aparelho?: string | null
          chave_hash?: string
          comercio_id?: string
          criado_em?: string
          desbloqueado_ate?: string | null
          encerrado_em?: string | null
          funcionario_id?: string
          id?: string
          ultimo_uso?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionario_aparelhos_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionario_aparelhos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          bloqueado_em: string | null
          caixa: boolean
          codigo: string
          codigo_gerado_em: string
          comercio_id: string
          created_at: string
          criado_por: string
          funcao: string
          id: string
          nome: string
          pin_criado_em: string | null
          pin_hash: string | null
          pin_tentativas: number
          travado_ate: string | null
          ultimo_acesso: string | null
          updated_at: string
        }
        Insert: {
          bloqueado_em?: string | null
          caixa?: boolean
          codigo: string
          codigo_gerado_em?: string
          comercio_id: string
          created_at?: string
          criado_por: string
          funcao: string
          id?: string
          nome: string
          pin_criado_em?: string | null
          pin_hash?: string | null
          pin_tentativas?: number
          travado_ate?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Update: {
          bloqueado_em?: string | null
          caixa?: boolean
          codigo?: string
          codigo_gerado_em?: string
          comercio_id?: string
          created_at?: string
          criado_por?: string
          funcao?: string
          id?: string
          nome?: string
          pin_criado_em?: string | null
          pin_hash?: string | null
          pin_tentativas?: number
          travado_ate?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      locais: {
        Row: {
          area: Database["public"]["Enums"]["area_estoque"]
          comercio_id: string
          created_at: string
          id: string
          nome: string
          nome_norm: string | null
        }
        Insert: {
          area: Database["public"]["Enums"]["area_estoque"]
          comercio_id: string
          created_at?: string
          id?: string
          nome: string
          nome_norm?: string | null
        }
        Update: {
          area?: Database["public"]["Enums"]["area_estoque"]
          comercio_id?: string
          created_at?: string
          id?: string
          nome?: string
          nome_norm?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locais_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes: {
        Row: {
          comercio_id: string
          created_at: string
          id: string
          numero: string | null
          numero_norm: string | null
          produto_id: string
          variacao_id: string | null
          vencimento: string | null
          vencimento_definido_em: string | null
          vencimento_definido_por: string | null
        }
        Insert: {
          comercio_id: string
          created_at?: string
          id?: string
          numero?: string | null
          numero_norm?: string | null
          produto_id: string
          variacao_id?: string | null
          vencimento?: string | null
          vencimento_definido_em?: string | null
          vencimento_definido_por?: string | null
        }
        Update: {
          comercio_id?: string
          created_at?: string
          id?: string
          numero?: string | null
          numero_norm?: string | null
          produto_id?: string
          variacao_id?: string | null
          vencimento?: string | null
          vencimento_definido_em?: string | null
          vencimento_definido_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lotes_produto_id_comercio_id_fkey"
            columns: ["produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id", "comercio_id"]
          },
          {
            foreignKeyName: "lotes_variacao_id_produto_id_comercio_id_fkey"
            columns: ["variacao_id", "produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produto_variacoes"
            referencedColumns: ["id", "produto_id", "comercio_id"]
          },
        ]
      }
      movimentos: {
        Row: {
          area: Database["public"]["Enums"]["area_estoque"]
          comercio_id: string
          created_at: string
          criado_por: string
          funcionario_id: string | null
          id: string
          local_id: string | null
          lote_id: string | null
          operacao_id: string
          produto_id: string
          quantidade: number
          saldo_id: string
          tipo: Database["public"]["Enums"]["tipo_movimento"]
          variacao_id: string | null
        }
        Insert: {
          area: Database["public"]["Enums"]["area_estoque"]
          comercio_id: string
          created_at?: string
          criado_por: string
          funcionario_id?: string | null
          id?: string
          local_id?: string | null
          lote_id?: string | null
          operacao_id: string
          produto_id: string
          quantidade: number
          saldo_id: string
          tipo: Database["public"]["Enums"]["tipo_movimento"]
          variacao_id?: string | null
        }
        Update: {
          area?: Database["public"]["Enums"]["area_estoque"]
          comercio_id?: string
          created_at?: string
          criado_por?: string
          funcionario_id?: string | null
          id?: string
          local_id?: string | null
          lote_id?: string | null
          operacao_id?: string
          produto_id?: string
          quantidade?: number
          saldo_id?: string
          tipo?: Database["public"]["Enums"]["tipo_movimento"]
          variacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_local_id_comercio_id_area_fkey"
            columns: ["local_id", "comercio_id", "area"]
            isOneToOne: false
            referencedRelation: "locais"
            referencedColumns: ["id", "comercio_id", "area"]
          },
          {
            foreignKeyName: "movimentos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_operacao_id_fkey"
            columns: ["operacao_id"]
            isOneToOne: false
            referencedRelation: "operacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_produto_id_comercio_id_fkey"
            columns: ["produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id", "comercio_id"]
          },
          {
            foreignKeyName: "movimentos_saldo_id_fkey"
            columns: ["saldo_id"]
            isOneToOne: false
            referencedRelation: "saldos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentos_variacao_id_produto_id_comercio_id_fkey"
            columns: ["variacao_id", "produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produto_variacoes"
            referencedColumns: ["id", "produto_id", "comercio_id"]
          },
        ]
      }
      operacoes: {
        Row: {
          comercio_id: string
          created_at: string
          funcionario_id: string | null
          hash: string
          id: string
          produto_id: string
          resultado: Json | null
          tipo: string
          user_id: string
        }
        Insert: {
          comercio_id: string
          created_at?: string
          funcionario_id?: string | null
          hash: string
          id: string
          produto_id: string
          resultado?: Json | null
          tipo: string
          user_id: string
        }
        Update: {
          comercio_id?: string
          created_at?: string
          funcionario_id?: string | null
          hash?: string
          id?: string
          produto_id?: string
          resultado?: Json | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operacoes_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operacoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_itens: {
        Row: {
          comercio_id: string
          created_at: string
          embalagem_id: string | null
          id: string
          pedido_id: string
          preco_estimado: number | null
          produto_id: string
          qtd_confirmada: number | null
          qtd_embalagens: number
          qtd_recebida: number | null
          qtd_unidades: number
          variacao_id: string | null
        }
        Insert: {
          comercio_id: string
          created_at?: string
          embalagem_id?: string | null
          id?: string
          pedido_id: string
          preco_estimado?: number | null
          produto_id: string
          qtd_confirmada?: number | null
          qtd_embalagens: number
          qtd_recebida?: number | null
          qtd_unidades: number
          variacao_id?: string | null
        }
        Update: {
          comercio_id?: string
          created_at?: string
          embalagem_id?: string | null
          id?: string
          pedido_id?: string
          preco_estimado?: number | null
          produto_id?: string
          qtd_confirmada?: number | null
          qtd_embalagens?: number
          qtd_recebida?: number | null
          qtd_unidades?: number
          variacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_embalagem_id_fkey"
            columns: ["embalagem_id"]
            isOneToOne: false
            referencedRelation: "produto_embalagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_variacao_id_fkey"
            columns: ["variacao_id"]
            isOneToOne: false
            referencedRelation: "produto_variacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_compra: {
        Row: {
          canal: string | null
          comercio_id: string
          created_at: string
          criado_por: string
          enviado_em: string | null
          forma_pagamento: string | null
          fornecedor_id: string
          id: string
          numero: number
          observacao: string | null
          pagamento_situacao: string | null
          pago_em: string | null
          prazo_dias: number | null
          previsao_entrega: string | null
          recado_fornecedor: string | null
          resposta_em: string | null
          situacao: string
          token: string
          updated_at: string
          valor_fornecedor: number | null
          valor_total: number | null
          vencimento: string | null
        }
        Insert: {
          canal?: string | null
          comercio_id: string
          created_at?: string
          criado_por: string
          enviado_em?: string | null
          forma_pagamento?: string | null
          fornecedor_id: string
          id: string
          numero: number
          observacao?: string | null
          pagamento_situacao?: string | null
          pago_em?: string | null
          prazo_dias?: number | null
          previsao_entrega?: string | null
          recado_fornecedor?: string | null
          resposta_em?: string | null
          situacao?: string
          token?: string
          updated_at?: string
          valor_fornecedor?: number | null
          valor_total?: number | null
          vencimento?: string | null
        }
        Update: {
          canal?: string | null
          comercio_id?: string
          created_at?: string
          criado_por?: string
          enviado_em?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string
          id?: string
          numero?: number
          observacao?: string | null
          pagamento_situacao?: string | null
          pago_em?: string | null
          prazo_dias?: number | null
          previsao_entrega?: string | null
          recado_fornecedor?: string | null
          resposta_em?: string | null
          situacao?: string
          token?: string
          updated_at?: string
          valor_fornecedor?: number | null
          valor_total?: number | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_compra_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      perdas: {
        Row: {
          area: Database["public"]["Enums"]["area_estoque"]
          baixado: number
          comercio_id: string
          created_at: string
          decidida_em: string | null
          diferenca_id: string | null
          funcionario_id: string | null
          id: string
          motivo: string
          observacao: string | null
          operacao_id: string | null
          produto_id: string
          quantidade: number
          registrado_por: string | null
          situacao: string
          variacao_id: string | null
        }
        Insert: {
          area: Database["public"]["Enums"]["area_estoque"]
          baixado?: number
          comercio_id: string
          created_at?: string
          decidida_em?: string | null
          diferenca_id?: string | null
          funcionario_id?: string | null
          id: string
          motivo: string
          observacao?: string | null
          operacao_id?: string | null
          produto_id: string
          quantidade: number
          registrado_por?: string | null
          situacao: string
          variacao_id?: string | null
        }
        Update: {
          area?: Database["public"]["Enums"]["area_estoque"]
          baixado?: number
          comercio_id?: string
          created_at?: string
          decidida_em?: string | null
          diferenca_id?: string | null
          funcionario_id?: string | null
          id?: string
          motivo?: string
          observacao?: string | null
          operacao_id?: string | null
          produto_id?: string
          quantidade?: number
          registrado_por?: string | null
          situacao?: string
          variacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perdas_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perdas_diferenca_id_fkey"
            columns: ["diferenca_id"]
            isOneToOne: false
            referencedRelation: "diferencas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perdas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perdas_operacao_id_fkey"
            columns: ["operacao_id"]
            isOneToOne: false
            referencedRelation: "operacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perdas_produto_id_comercio_id_fkey"
            columns: ["produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id", "comercio_id"]
          },
          {
            foreignKeyName: "perdas_variacao_id_produto_id_comercio_id_fkey"
            columns: ["variacao_id", "produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produto_variacoes"
            referencedColumns: ["id", "produto_id", "comercio_id"]
          },
        ]
      }
      produto_areas: {
        Row: {
          area: Database["public"]["Enums"]["area_estoque"]
          comercio_id: string
          id: string
          local_definido_em: string | null
          local_definido_por: string | null
          local_id: string | null
          maximo: number | null
          minimo: number | null
          produto_id: string
          updated_at: string
          variacao_id: string | null
        }
        Insert: {
          area: Database["public"]["Enums"]["area_estoque"]
          comercio_id: string
          id?: string
          local_definido_em?: string | null
          local_definido_por?: string | null
          local_id?: string | null
          maximo?: number | null
          minimo?: number | null
          produto_id: string
          updated_at?: string
          variacao_id?: string | null
        }
        Update: {
          area?: Database["public"]["Enums"]["area_estoque"]
          comercio_id?: string
          id?: string
          local_definido_em?: string | null
          local_definido_por?: string | null
          local_id?: string | null
          maximo?: number | null
          minimo?: number | null
          produto_id?: string
          updated_at?: string
          variacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produto_areas_local_id_comercio_id_area_fkey"
            columns: ["local_id", "comercio_id", "area"]
            isOneToOne: false
            referencedRelation: "locais"
            referencedColumns: ["id", "comercio_id", "area"]
          },
          {
            foreignKeyName: "produto_areas_produto_id_comercio_id_fkey"
            columns: ["produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id", "comercio_id"]
          },
          {
            foreignKeyName: "produto_areas_variacao_id_produto_id_comercio_id_fkey"
            columns: ["variacao_id", "produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produto_variacoes"
            referencedColumns: ["id", "produto_id", "comercio_id"]
          },
        ]
      }
      produto_embalagens: {
        Row: {
          codigo_barras: string | null
          comercio_id: string
          created_at: string
          id: string
          preco_compra: number | null
          produto_id: string
          quantidade: number
          removida_em: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          codigo_barras?: string | null
          comercio_id: string
          created_at?: string
          id: string
          preco_compra?: number | null
          produto_id: string
          quantidade: number
          removida_em?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          codigo_barras?: string | null
          comercio_id?: string
          created_at?: string
          id?: string
          preco_compra?: number | null
          produto_id?: string
          quantidade?: number
          removida_em?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_embalagens_produto_id_comercio_id_fkey"
            columns: ["produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id", "comercio_id"]
          },
        ]
      }
      produto_variacoes: {
        Row: {
          codigo_barras: string | null
          comercio_id: string
          cor: string | null
          created_at: string
          id: string
          produto_id: string
          qtd_informada: number | null
          removida_em: string | null
          tamanho: string | null
        }
        Insert: {
          codigo_barras?: string | null
          comercio_id: string
          cor?: string | null
          created_at?: string
          id?: string
          produto_id: string
          qtd_informada?: number | null
          removida_em?: string | null
          tamanho?: string | null
        }
        Update: {
          codigo_barras?: string | null
          comercio_id?: string
          cor?: string | null
          created_at?: string
          id?: string
          produto_id?: string
          qtd_informada?: number | null
          removida_em?: string | null
          tamanho?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "variacoes_produto_fk"
            columns: ["produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id", "comercio_id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          avisos_dias: number[]
          categoria: string | null
          codigo_barras: string | null
          comercio_id: string
          controla_validade: boolean | null
          created_at: string
          detalhes: Json
          fornecedor_id: string | null
          id: string
          marca: string | null
          nome: string
          preco_compra: number
          preco_venda: number
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          avisos_dias?: number[]
          categoria?: string | null
          codigo_barras?: string | null
          comercio_id: string
          controla_validade?: boolean | null
          created_at?: string
          detalhes?: Json
          fornecedor_id?: string | null
          id?: string
          marca?: string | null
          nome: string
          preco_compra: number
          preco_venda: number
          unidade: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          avisos_dias?: number[]
          categoria?: string | null
          codigo_barras?: string | null
          comercio_id?: string
          controla_validade?: boolean | null
          created_at?: string
          detalhes?: Json
          fornecedor_id?: string | null
          id?: string
          marca?: string | null
          nome?: string
          preco_compra?: number
          preco_venda?: number
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          nome: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recebimento_itens: {
        Row: {
          avaria: number
          comercio_id: string
          entrou_estoque: number
          esperado: number | null
          id: string
          no_pedido: boolean
          produto_id: string
          quantidade_aceita: number | null
          recebimento_id: string
          resolvido_em: string | null
          resolvido_por: string | null
          situacao: string
          tentativas: Json
          updated_at: string
          variacao_id: string | null
        }
        Insert: {
          avaria?: number
          comercio_id: string
          entrou_estoque?: number
          esperado?: number | null
          id?: string
          no_pedido: boolean
          produto_id: string
          quantidade_aceita?: number | null
          recebimento_id: string
          resolvido_em?: string | null
          resolvido_por?: string | null
          situacao: string
          tentativas?: Json
          updated_at?: string
          variacao_id?: string | null
        }
        Update: {
          avaria?: number
          comercio_id?: string
          entrou_estoque?: number
          esperado?: number | null
          id?: string
          no_pedido?: boolean
          produto_id?: string
          quantidade_aceita?: number | null
          recebimento_id?: string
          resolvido_em?: string | null
          resolvido_por?: string | null
          situacao?: string
          tentativas?: Json
          updated_at?: string
          variacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recebimento_itens_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimento_itens_produto_id_comercio_id_fkey"
            columns: ["produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id", "comercio_id"]
          },
          {
            foreignKeyName: "recebimento_itens_recebimento_id_fkey"
            columns: ["recebimento_id"]
            isOneToOne: false
            referencedRelation: "recebimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimento_itens_variacao_id_produto_id_comercio_id_fkey"
            columns: ["variacao_id", "produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produto_variacoes"
            referencedColumns: ["id", "produto_id", "comercio_id"]
          },
        ]
      }
      recebimentos: {
        Row: {
          comercio_id: string
          concluido_em: string | null
          fornecedor_id: string | null
          funcionario_id: string
          id: string
          iniciado_em: string
          pedido_id: string | null
          rodada: number
          situacao: string
          ultimo_resultado: Json | null
          updated_at: string
        }
        Insert: {
          comercio_id: string
          concluido_em?: string | null
          fornecedor_id?: string | null
          funcionario_id: string
          id: string
          iniciado_em?: string
          pedido_id?: string | null
          rodada?: number
          situacao?: string
          ultimo_resultado?: Json | null
          updated_at?: string
        }
        Update: {
          comercio_id?: string
          concluido_em?: string | null
          fornecedor_id?: string | null
          funcionario_id?: string
          id?: string
          iniciado_em?: string
          pedido_id?: string | null
          rodada?: number
          situacao?: string
          ultimo_resultado?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      reposicoes: {
        Row: {
          comercio_id: string
          concluido_em: string | null
          contado: number
          created_at: string
          esperado: number
          funcionario_id: string
          id: string
          levado: number | null
          operacao_id: string | null
          produto_id: string
          situacao: string
          sugerido: number
          variacao_id: string | null
        }
        Insert: {
          comercio_id: string
          concluido_em?: string | null
          contado: number
          created_at?: string
          esperado: number
          funcionario_id: string
          id: string
          levado?: number | null
          operacao_id?: string | null
          produto_id: string
          situacao?: string
          sugerido: number
          variacao_id?: string | null
        }
        Update: {
          comercio_id?: string
          concluido_em?: string | null
          contado?: number
          created_at?: string
          esperado?: number
          funcionario_id?: string
          id?: string
          levado?: number | null
          operacao_id?: string | null
          produto_id?: string
          situacao?: string
          sugerido?: number
          variacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reposicoes_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reposicoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reposicoes_operacao_id_fkey"
            columns: ["operacao_id"]
            isOneToOne: false
            referencedRelation: "operacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reposicoes_produto_id_comercio_id_fkey"
            columns: ["produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id", "comercio_id"]
          },
          {
            foreignKeyName: "reposicoes_variacao_id_produto_id_comercio_id_fkey"
            columns: ["variacao_id", "produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produto_variacoes"
            referencedColumns: ["id", "produto_id", "comercio_id"]
          },
        ]
      }
      saldos: {
        Row: {
          area: Database["public"]["Enums"]["area_estoque"]
          comercio_id: string
          id: string
          lote_id: string | null
          origem_id: string | null
          pendencia_confirmada: boolean
          pendente: boolean
          produto_id: string
          quantidade: number
          updated_at: string
          variacao_id: string | null
        }
        Insert: {
          area: Database["public"]["Enums"]["area_estoque"]
          comercio_id: string
          id?: string
          lote_id?: string | null
          origem_id?: string | null
          pendencia_confirmada?: boolean
          pendente?: boolean
          produto_id: string
          quantidade: number
          updated_at?: string
          variacao_id?: string | null
        }
        Update: {
          area?: Database["public"]["Enums"]["area_estoque"]
          comercio_id?: string
          id?: string
          lote_id?: string | null
          origem_id?: string | null
          pendencia_confirmada?: boolean
          pendente?: boolean
          produto_id?: string
          quantidade?: number
          updated_at?: string
          variacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saldos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saldos_origem_id_fkey"
            columns: ["origem_id"]
            isOneToOne: false
            referencedRelation: "saldos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saldos_produto_id_comercio_id_fkey"
            columns: ["produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id", "comercio_id"]
          },
          {
            foreignKeyName: "saldos_variacao_id_produto_id_comercio_id_fkey"
            columns: ["variacao_id", "produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produto_variacoes"
            referencedColumns: ["id", "produto_id", "comercio_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venda_itens: {
        Row: {
          codigo_barras: string | null
          codigo_pdv: string
          comercio_id: string
          descricao: string
          embalagem_id: string | null
          id: string
          motivo: string | null
          n_item: number
          operacao_id: string | null
          partes: Json
          produto_id: string | null
          qtd_baixada: number
          qtd_faltou: number
          qtd_nota: number
          qtd_unidades: number | null
          resolvido_em: string | null
          situacao: string
          unidade_nota: string | null
          valor: number
          variacao_id: string | null
          venda_id: string
        }
        Insert: {
          codigo_barras?: string | null
          codigo_pdv: string
          comercio_id: string
          descricao: string
          embalagem_id?: string | null
          id?: string
          motivo?: string | null
          n_item: number
          operacao_id?: string | null
          partes?: Json
          produto_id?: string | null
          qtd_baixada?: number
          qtd_faltou?: number
          qtd_nota: number
          qtd_unidades?: number | null
          resolvido_em?: string | null
          situacao: string
          unidade_nota?: string | null
          valor?: number
          variacao_id?: string | null
          venda_id: string
        }
        Update: {
          codigo_barras?: string | null
          codigo_pdv?: string
          comercio_id?: string
          descricao?: string
          embalagem_id?: string | null
          id?: string
          motivo?: string | null
          n_item?: number
          operacao_id?: string | null
          partes?: Json
          produto_id?: string | null
          qtd_baixada?: number
          qtd_faltou?: number
          qtd_nota?: number
          qtd_unidades?: number | null
          resolvido_em?: string | null
          situacao?: string
          unidade_nota?: string | null
          valor?: number
          variacao_id?: string | null
          venda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venda_itens_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_itens_embalagem_id_fkey"
            columns: ["embalagem_id"]
            isOneToOne: false
            referencedRelation: "produto_embalagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_itens_operacao_id_fkey"
            columns: ["operacao_id"]
            isOneToOne: false
            referencedRelation: "operacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venda_itens_produto_id_comercio_id_fkey"
            columns: ["produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id", "comercio_id"]
          },
          {
            foreignKeyName: "venda_itens_variacao_id_produto_id_comercio_id_fkey"
            columns: ["variacao_id", "produto_id", "comercio_id"]
            isOneToOne: false
            referencedRelation: "produto_variacoes"
            referencedColumns: ["id", "produto_id", "comercio_id"]
          },
          {
            foreignKeyName: "venda_itens_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          caixa_id: string
          cancelada_em: string | null
          cancelada_por: string | null
          chave_nota: string | null
          cliente_fiado_id: string | null
          comercio_id: string
          emitida_em: string | null
          funcionario_id: string | null
          id: string
          motivo_cancelamento: string | null
          nota: Json | null
          numero: number | null
          origem: string
          pagamentos: Json
          recebida_em: string
          serie: number | null
          situacao: string
          total: number
          troco: number
          turno_id: string | null
        }
        Insert: {
          caixa_id: string
          cancelada_em?: string | null
          cancelada_por?: string | null
          chave_nota?: string | null
          cliente_fiado_id?: string | null
          comercio_id: string
          emitida_em?: string | null
          funcionario_id?: string | null
          id?: string
          motivo_cancelamento?: string | null
          nota?: Json | null
          numero?: number | null
          origem?: string
          pagamentos?: Json
          recebida_em?: string
          serie?: number | null
          situacao?: string
          total?: number
          troco?: number
          turno_id?: string | null
        }
        Update: {
          caixa_id?: string
          cancelada_em?: string | null
          cancelada_por?: string | null
          chave_nota?: string | null
          cliente_fiado_id?: string | null
          comercio_id?: string
          emitida_em?: string | null
          funcionario_id?: string | null
          id?: string
          motivo_cancelamento?: string | null
          nota?: Json | null
          numero?: number | null
          origem?: string
          pagamentos?: Json
          recebida_em?: string
          serie?: number | null
          situacao?: string
          total?: number
          troco?: number
          turno_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_cliente_fiado_id_fkey"
            columns: ["cliente_fiado_id"]
            isOneToOne: false
            referencedRelation: "clientes_fiado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_comercio_id_fkey"
            columns: ["comercio_id"]
            isOneToOne: false
            referencedRelation: "comercios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "caixa_turnos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _acertar_area: {
        Args: {
          _area: Database["public"]["Enums"]["area_estoque"]
          _com: string
          _func: string
          _novo: number
          _op: string
          _prod: string
          _user: string
          _var: string
        }
        Returns: number
      }
      _achar_item_venda: {
        Args: { _codigo: string; _com: string; _ean: string }
        Returns: Record<string, unknown>
      }
      _baixar_item_venda: { Args: { _item: string }; Returns: undefined }
      _caixa_da_chave: {
        Args: { _chave: string }
        Returns: {
          aparelho: string | null
          chave_hash: string | null
          codigo: string | null
          codigo_gerado_em: string | null
          comercio_id: string
          created_at: string
          desligado_em: string | null
          funcionario_id: string | null
          id: string
          ligado_em: string | null
          nome: string
          tipo: string
          ultima_venda_em: string | null
          ultimo_contato_em: string | null
        }
        SetofOptions: {
          from: "*"
          to: "caixas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _cancelar_venda_celular: {
        Args: { _motivo: string; _por: string; _venda: string }
        Returns: undefined
      }
      _catalogo_buscar_fora: { Args: { _cod: string }; Returns: string }
      _catalogo_gravar: { Args: { h: Json }; Returns: string }
      _catalogo_importar: {
        Args: { _pagina: number; _q: string }
        Returns: Json
      }
      _codigo_caixa_novo: { Args: never; Returns: string }
      _conferir_pin_dono: {
        Args: { _com: string; _pin: string }
        Returns: string
      }
      _devolver_item_venda: { Args: { _item: string }; Returns: undefined }
      _embalagem_em_uso: { Args: { _id: string }; Returns: boolean }
      _entrar_no_deposito: {
        Args: { _func: string; _item: string; _tentativa: Json; _user: string }
        Returns: number
      }
      _fechar_pedido_recebido: { Args: { _pedido: string }; Returns: undefined }
      _fiado_link: {
        Args: { _cliente: string; _comercio: string }
        Returns: string
      }
      _fiado_novo_token: { Args: never; Returns: string }
      _funcionario_caixa: {
        Args: { _chave: string }
        Returns: {
          bloqueado_em: string | null
          caixa: boolean
          codigo: string
          codigo_gerado_em: string
          comercio_id: string
          created_at: string
          criado_por: string
          funcao: string
          id: string
          nome: string
          pin_criado_em: string | null
          pin_hash: string | null
          pin_tentativas: number
          travado_ate: string | null
          ultimo_acesso: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "funcionarios"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _funcionario_da_chave: {
        Args: { _chave: string }
        Returns: {
          bloqueado_em: string | null
          caixa: boolean
          codigo: string
          codigo_gerado_em: string
          comercio_id: string
          created_at: string
          criado_por: string
          funcao: string
          id: string
          nome: string
          pin_criado_em: string | null
          pin_hash: string | null
          pin_tentativas: number
          travado_ate: string | null
          ultimo_acesso: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "funcionarios"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _funcionario_recebe: {
        Args: { _chave: string }
        Returns: {
          bloqueado_em: string | null
          caixa: boolean
          codigo: string
          codigo_gerado_em: string
          comercio_id: string
          created_at: string
          criado_por: string
          funcao: string
          id: string
          nome: string
          pin_criado_em: string | null
          pin_hash: string | null
          pin_tentativas: number
          travado_ate: string | null
          ultimo_acesso: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "funcionarios"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _funcionario_repoe: {
        Args: { _chave: string }
        Returns: {
          bloqueado_em: string | null
          caixa: boolean
          codigo: string
          codigo_gerado_em: string
          comercio_id: string
          created_at: string
          criado_por: string
          funcao: string
          id: string
          nome: string
          pin_criado_em: string | null
          pin_hash: string | null
          pin_tentativas: number
          travado_ate: string | null
          ultimo_acesso: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "funcionarios"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _iniciar_operacao: {
        Args: {
          _com: string
          _hash: string
          _op: string
          _prod: string
          _tipo: string
        }
        Returns: Json
      }
      _lancar_perda: {
        Args: {
          _area: string
          _com: string
          _dono_registra: string
          _func: string
          _id: string
          _motivo: string
          _obs: string
          _prod: string
          _qtd: number
          _var: string
        }
        Returns: {
          area: Database["public"]["Enums"]["area_estoque"]
          baixado: number
          comercio_id: string
          created_at: string
          decidida_em: string | null
          diferenca_id: string | null
          funcionario_id: string | null
          id: string
          motivo: string
          observacao: string | null
          operacao_id: string | null
          produto_id: string
          quantidade: number
          registrado_por: string | null
          situacao: string
          variacao_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "perdas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _lote_da_parte: {
        Args: {
          _com: string
          _numero: string
          _prod: string
          _var: string
          _venc: string
        }
        Returns: string
      }
      _motivo_sem_reposicao: {
        Args: { _prod: string; _var: string }
        Returns: string
      }
      _novo_codigo_funcionario: { Args: never; Returns: string }
      _por_saldo: {
        Args: {
          _area: Database["public"]["Enums"]["area_estoque"]
          _com: string
          _func: string
          _local: string
          _lote: string
          _op: string
          _pend: boolean
          _pendconf: boolean
          _prod: string
          _qtd: number
          _tipo: Database["public"]["Enums"]["tipo_movimento"]
          _user: string
          _var: string
        }
        Returns: undefined
      }
      _produto_para_funcionario: {
        Args: { _emb: string; _prod: string; _var: string }
        Returns: Json
      }
      _produtos_visados: {
        Args: { _com: string }
        Returns: {
          produto_id: string
          variacao_id: string
        }[]
      }
      _registrar_diferenca: {
        Args: {
          _area: Database["public"]["Enums"]["area_estoque"]
          _com: string
          _contado: number
          _detalhes?: Json
          _esperado: number
          _func: string
          _origem: string
          _prod: string
          _ref: string
          _var: string
        }
        Returns: string
      }
      _resumo_turno: { Args: { _turno: string }; Returns: Json }
      _saldo_reponivel: {
        Args: { _prod: string; _var: string }
        Returns: number
      }
      _salvar_embalagens: {
        Args: { _com: string; _lista: Json; _prod: string }
        Returns: number
      }
      _tirar_saldo: {
        Args: {
          _area: Database["public"]["Enums"]["area_estoque"]
          _com: string
          _func: string
          _local: string
          _op: string
          _prod: string
          _qtd: number
          _tipo: Database["public"]["Enums"]["tipo_movimento"]
          _user: string
          _var: string
        }
        Returns: Json
      }
      _tirar_saldo_reposicao: {
        Args: {
          _area: Database["public"]["Enums"]["area_estoque"]
          _com: string
          _func: string
          _local: string
          _op: string
          _prod: string
          _qtd: number
          _tipo: Database["public"]["Enums"]["tipo_movimento"]
          _user: string
          _var: string
        }
        Returns: Json
      }
      _unidades_item: {
        Args: { _emb: string; _prod: string; _qtd: number }
        Returns: Record<string, unknown>
      }
      atualizar_funcionario: {
        Args: { _funcao: string; _id: string; _nome: string }
        Returns: undefined
      }
      atualizar_pagamento: {
        Args: { _pedido: string; p: Json }
        Returns: undefined
      }
      bloquear_funcionario: {
        Args: { _bloquear: boolean; _id: string }
        Returns: Json
      }
      buscar_catalogo: { Args: { _codigo: string }; Returns: Json }
      caixa_abrir: {
        Args: { _chave: string; _id: string; _troco: number }
        Returns: Json
      }
      caixa_cancelar_venda: {
        Args: {
          _chave: string
          _motivo: string
          _pin_dono: string
          _venda: string
        }
        Returns: Json
      }
      caixa_cliente_fiado_historico: {
        Args: { _chave: string; _cliente: string }
        Returns: Json
      }
      caixa_clientes_fiado: { Args: { _chave: string }; Returns: Json }
      caixa_estado: { Args: { _chave: string }; Returns: Json }
      caixa_fechar: {
        Args: {
          _chave: string
          _contado: number
          _observacao: string
          _turno: string
        }
        Returns: Json
      }
      caixa_fiado_cliente_link: {
        Args: { _chave: string; _cliente: string }
        Returns: string
      }
      caixa_produtos: { Args: { _chave: string }; Returns: Json }
      caixa_receber_fiado: {
        Args: {
          _chave: string
          _cliente: string
          _forma: string
          _id: string
          _turno: string
          _valor: number
        }
        Returns: Json
      }
      caixa_registrar_venda: {
        Args: { _chave: string; _venda: Json }
        Returns: Json
      }
      caixa_salvar_cliente_fiado: {
        Args: { _chave: string; _id: string; _nome: string; _telefone: string }
        Returns: Json
      }
      caixa_sangria: {
        Args: {
          _chave: string
          _id: string
          _motivo: string
          _pin_dono: string
          _turno: string
          _valor: number
        }
        Returns: Json
      }
      cancelar_pedido: { Args: { _pedido: string }; Returns: undefined }
      cancelar_venda_celular: {
        Args: { _motivo: string; _venda: string }
        Returns: Json
      }
      chave_nota_valida: { Args: { _c: string }; Returns: boolean }
      conector_cancelar_venda: {
        Args: { _chave: string; _chave_nota: string }
        Returns: Json
      }
      conector_enviar_venda: {
        Args: { _chave: string; _nota: Json }
        Returns: Json
      }
      conector_estado: { Args: { _chave: string }; Returns: Json }
      conector_ligar: {
        Args: { _aparelho: string; _codigo: string }
        Returns: Json
      }
      conferir_codigo_funcionario: {
        Args: { _codigo: string }
        Returns: string
      }
      conferir_fechamento_caixa: {
        Args: { _turno: string }
        Returns: undefined
      }
      criar_caixa: { Args: { _comercio: string; _nome: string }; Returns: Json }
      criar_funcionario: {
        Args: { _comercio: string; _funcao: string; _nome: string }
        Returns: Json
      }
      decidir_perda: {
        Args: { _aceitar: boolean; _id: string }
        Returns: undefined
      }
      definir_caixa_funcionario: {
        Args: { _caixa: boolean; _id: string }
        Returns: undefined
      }
      definir_limite_faltas: {
        Args: { _comercio: string; _valor: number }
        Returns: undefined
      }
      definir_limite_fiado: {
        Args: { _bloqueado: boolean; _cliente: string; _limite: number }
        Returns: undefined
      }
      definir_pin_dono: { Args: { _pin: string }; Returns: undefined }
      desligar_caixa: { Args: { _id: string }; Returns: undefined }
      ean_upc_mercado: { Args: { _codigo: string }; Returns: string }
      entrar_funcionario: {
        Args: { _aparelho: string; _codigo: string; _pin: string }
        Returns: Json
      }
      explicar_diferenca: {
        Args: { _id: string; _motivo: string; _observacao: string }
        Returns: undefined
      }
      fiado_acesso_info: { Args: { _cliente: string }; Returns: Json }
      fiado_cliente_link: { Args: { _cliente: string }; Returns: string }
      fiado_novo_link: { Args: { _cliente: string }; Returns: string }
      fiado_publico_entrar: {
        Args: { _final_tel: string; _pin: string; _token: string }
        Returns: Json
      }
      fiado_publico_estado: { Args: { _token: string }; Returns: Json }
      fiado_publico_extrato: {
        Args: { _sessao: string; _token: string }
        Returns: Json
      }
      fiado_zerar_pin: { Args: { _cliente: string }; Returns: undefined }
      funcionario_abrir_recebimento: {
        Args: {
          _chave: string
          _fornecedor: string
          _id: string
          _pedido: string
        }
        Returns: Json
      }
      funcionario_buscar_produto: {
        Args: { _chave: string; _texto: string }
        Returns: Json
      }
      funcionario_conferencia_contar:
        | {
            Args: {
              _chave: string
              _contado: number
              _id: string
              _produto: string
              _variacao: string
            }
            Returns: Json
          }
        | {
            Args: {
              _chave: string
              _contado: number
              _id: string
              _produto: string
              _rodada: number
              _variacao: string
            }
            Returns: Json
          }
      funcionario_conferencia_lista: { Args: { _chave: string }; Returns: Json }
      funcionario_desbloquear: {
        Args: { _chave: string; _pin: string }
        Returns: Json
      }
      funcionario_entregas: { Args: { _chave: string }; Returns: Json }
      funcionario_enviar_recebimento: {
        Args: { _chave: string; _id: string; _itens: Json; _rodada: number }
        Returns: Json
      }
      funcionario_inicio: { Args: { _chave: string }; Returns: Json }
      funcionario_registrar_perda: {
        Args: {
          _area: string
          _chave: string
          _id: string
          _motivo: string
          _observacao: string
          _produto: string
          _quantidade: number
          _variacao: string
        }
        Returns: Json
      }
      funcionario_reposicao_concluir: {
        Args: { _chave: string; _id: string; _levado: number }
        Returns: Json
      }
      funcionario_reposicao_contar: {
        Args: {
          _chave: string
          _contado: number
          _id: string
          _produto: string
          _rodada?: number
          _variacao: string
        }
        Returns: Json
      }
      funcionario_reposicao_lista: { Args: { _chave: string }; Returns: Json }
      gerar_codigo_interno: { Args: { _comercio: string }; Returns: string }
      gtin_canonico: { Args: { _c: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      marcar_pedido_enviado: {
        Args: { _canal: string; _pedido: string }
        Returns: undefined
      }
      normalizar_lote: { Args: { _t: string }; Returns: string }
      novo_acesso_funcionario: { Args: { _id: string }; Returns: Json }
      novo_codigo_caixa: { Args: { _id: string }; Returns: string }
      novo_link_pedido: { Args: { _pedido: string }; Returns: string }
      pedido_publico: { Args: { _token: string }; Returns: Json }
      pode_acessar_comercio: { Args: { _comercio: string }; Returns: boolean }
      qtd_valida: {
        Args: { _permite_zero: boolean; _q: number; _u: string }
        Returns: number
      }
      receber_fiado: {
        Args: {
          _cliente: string
          _forma: string
          _id: string
          _observacao: string
          _valor: number
        }
        Returns: Json
      }
      registrar_perda: { Args: { p: Json }; Returns: Json }
      renomear_caixa: {
        Args: { _id: string; _nome: string }
        Returns: undefined
      }
      resolver_conferencia: {
        Args: { _contado: number; _diferenca: string }
        Returns: Json
      }
      resolver_item_recebimento: {
        Args: { _acao: string; _item: string; _tentativa: number }
        Returns: undefined
      }
      resolver_item_venda: {
        Args: {
          _acao: string
          _embalagem: string
          _item: string
          _produto: string
          _variacao: string
        }
        Returns: Json
      }
      resolver_pendencia: { Args: { p: Json }; Returns: Json }
      responder_pedido: { Args: { _token: string; r: Json }; Returns: Json }
      sair_funcionario: { Args: { _chave: string }; Returns: undefined }
      saldo_chave: {
        Args: {
          _a: Database["public"]["Enums"]["area_estoque"]
          _p: string
          _v: string
        }
        Returns: number
      }
      salvar_cadastro: { Args: { p: Json }; Returns: Json }
      salvar_cliente_fiado: {
        Args: {
          _ativo: boolean
          _comercio: string
          _id: string
          _nome: string
          _telefone: string
        }
        Returns: undefined
      }
      salvar_pedido: { Args: { p: Json }; Returns: Json }
      salvar_produto: { Args: { p: Json }; Returns: Json }
      tamanho_valido: { Args: { _t: string }; Returns: boolean }
      tem_pin_dono: { Args: never; Returns: boolean }
      unidade_fracionada: { Args: { _u: string }; Returns: boolean }
      validar_tipo: {
        Args: {
          _cat: string
          _det: Json
          _tipo: Database["public"]["Enums"]["tipo_comercio"]
          _un: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "dono" | "gerente" | "repositor"
      area_estoque: "deposito" | "venda"
      tipo_comercio:
        | "mercado"
        | "farmacia"
        | "loja_roupas"
        | "material_construcao"
        | "pet_shop"
        | "autopecas"
      tipo_movimento:
        | "contagem_inicial"
        | "entrada"
        | "transferencia"
        | "ajuste"
        | "divisao_pendencia"
        | "venda"
        | "cancelamento_venda"
        | "perda"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["dono", "gerente", "repositor"],
      area_estoque: ["deposito", "venda"],
      tipo_comercio: [
        "mercado",
        "farmacia",
        "loja_roupas",
        "material_construcao",
        "pet_shop",
        "autopecas",
      ],
      tipo_movimento: [
        "contagem_inicial",
        "entrada",
        "transferencia",
        "ajuste",
        "divisao_pendencia",
        "venda",
        "cancelamento_venda",
        "perda",
      ],
    },
  },
} as const
