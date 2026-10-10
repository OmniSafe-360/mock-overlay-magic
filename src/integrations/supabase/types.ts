export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type DatabaseBase = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      codigos_barras: {
        Row: {
          codigo: string
          comercio_id: string
          embalagem_id: string | null
          produto_id: string
          variacao_id: string | null
        }
        Insert: {
          codigo: string
          comercio_id: string
          embalagem_id?: string | null
          produto_id: string
          variacao_id?: string | null
        }
        Update: {
          codigo?: string
          comercio_id?: string
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
          nome: string
          numero: string | null
          proximo_codigo_interno: number
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
          nome: string
          numero?: string | null
          proximo_codigo_interno?: number
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
          nome?: string
          numero?: string | null
          proximo_codigo_interno?: number
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
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      gerar_codigo_interno: { Args: { _comercio: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      normalizar_lote: { Args: { _t: string }; Returns: string }
      pode_acessar_comercio: { Args: { _comercio: string }; Returns: boolean }
      qtd_valida: {
        Args: { _permite_zero: boolean; _q: number; _u: string }
        Returns: number
      }
      resolver_pendencia: { Args: { p: Json }; Returns: Json }
      saldo_chave: {
        Args: {
          _a: Database["public"]["Enums"]["area_estoque"]
          _p: string
          _v: string
        }
        Returns: number
      }
      salvar_cadastro: { Args: { p: Json }; Returns: Json }
      salvar_produto: { Args: { p: Json }; Returns: Json }
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
      ],
    },
  },
} as const

// Contratos complementares das migrações operacionais do repositório.
// Conferidos em PostgreSQL descartável; não substituem uma futura geração do banco real.
type LinhasOperacionais = {
  caixas: {
    id: string
    comercio_id: string
    nome: string
    codigo: string | null
    codigo_gerado_em: string | null
    chave_hash: string | null
    aparelho: string | null
    ligado_em: string | null
    desligado_em: string | null
    ultimo_contato_em: string | null
    ultima_venda_em: string | null
    created_at: string
    tipo: string
    funcionario_id: string | null
  }
  codigos_barras: {
    comercio_id: string
    codigo: string
    produto_id: string
    variacao_id: string | null
    embalagem_id: string | null
    /** Migração 20261010123000: comparação UPC/EAN somente no Mercado; código original preservado. */
    ean_upc_mercado: string | null
  }
  codigos_pdv: {
    comercio_id: string
    codigo: string
    produto_id: string | null
    variacao_id: string | null
    embalagem_id: string | null
    ignorar: boolean
    criado_por: string
    criado_em: string
  }
  comercios: {
    id: string
    dono_id: string
    tipo: Database["public"]["Enums"]["tipo_comercio"]
    nome: string
    documento_tipo: string
    documento: string
    telefone: string
    telefone_whatsapp: boolean
    cep: string
    rua: string
    numero: string | null
    sem_numero: boolean
    complemento: string | null
    bairro: string
    cidade: string
    uf: string
    ativo: boolean
    created_at: string
    updated_at: string
    proximo_codigo_interno: number
    proximo_numero_pedido: number
    limite_faltas_mes: number
  }
  conferencias: {
    id: string
    comercio_id: string
    produto_id: string
    variacao_id: string | null
    area: Database["public"]["Enums"]["area_estoque"]
    funcionario_id: string
    tentativas: Json
    esperado: number | null
    contado: number | null
    situacao: string
    operacao_id: string | null
    diferenca_id: string | null
    created_at: string
    concluida_em: string | null
  }
  contagens: {
    id: string
    operacao_id: string
    comercio_id: string
    produto_id: string
    variacao_id: string | null
    area: Database["public"]["Enums"]["area_estoque"]
    quantidade: number
    criado_por: string
    created_at: string
  }
  diferencas: {
    id: string
    comercio_id: string
    produto_id: string
    variacao_id: string | null
    area: Database["public"]["Enums"]["area_estoque"]
    origem: string
    esperado: number
    contado: number
    diferenca: number
    valor: number
    funcionario_id: string | null
    referencia_id: string | null
    detalhes: Json
    situacao: string
    motivo: string | null
    observacao: string | null
    explicada_em: string | null
    explicada_por: string | null
    created_at: string
  }
  fornecedores: {
    id: string
    dono_id: string
    nome: string
    telefone: string | null
    email: string | null
    ativo: boolean
    created_at: string
    updated_at: string
  }
  funcionario_aparelhos: {
    id: string
    funcionario_id: string
    comercio_id: string
    chave_hash: string
    aparelho: string | null
    criado_em: string
    ultimo_uso: string
    encerrado_em: string | null
    desbloqueado_ate: string | null
  }
  funcionarios: {
    id: string
    comercio_id: string
    nome: string
    funcao: string
    codigo: string
    codigo_gerado_em: string
    pin_hash: string | null
    pin_criado_em: string | null
    pin_tentativas: number
    travado_ate: string | null
    bloqueado_em: string | null
    ultimo_acesso: string | null
    criado_por: string
    created_at: string
    updated_at: string
    caixa: boolean
  }
  locais: {
    id: string
    comercio_id: string
    area: Database["public"]["Enums"]["area_estoque"]
    nome: string
    nome_norm: string | null
    created_at: string
  }
  lotes: {
    id: string
    comercio_id: string
    produto_id: string
    variacao_id: string | null
    numero: string | null
    numero_norm: string | null
    vencimento: string | null
    vencimento_definido_por: string | null
    vencimento_definido_em: string | null
    created_at: string
  }
  movimentos: {
    id: string
    operacao_id: string
    comercio_id: string
    produto_id: string
    variacao_id: string | null
    area: Database["public"]["Enums"]["area_estoque"]
    local_id: string | null
    lote_id: string | null
    saldo_id: string
    tipo: Database["public"]["Enums"]["tipo_movimento"]
    quantidade: number
    criado_por: string
    created_at: string
    funcionario_id: string | null
  }
  operacoes: {
    id: string
    user_id: string
    comercio_id: string
    produto_id: string
    tipo: string
    hash: string
    resultado: Json | null
    created_at: string
    funcionario_id: string | null
  }
  pedido_itens: {
    id: string
    pedido_id: string
    comercio_id: string
    produto_id: string
    variacao_id: string | null
    embalagem_id: string | null
    qtd_embalagens: number
    qtd_unidades: number
    preco_estimado: number | null
    qtd_confirmada: number | null
    qtd_recebida: number | null
    created_at: string
  }
  pedidos_compra: {
    id: string
    comercio_id: string
    fornecedor_id: string
    numero: number
    situacao: string
    canal: string | null
    enviado_em: string | null
    observacao: string | null
    token: string
    resposta_em: string | null
    previsao_entrega: string | null
    valor_total: number | null
    forma_pagamento: string | null
    prazo_dias: number | null
    recado_fornecedor: string | null
    pagamento_situacao: string | null
    vencimento: string | null
    pago_em: string | null
    criado_por: string
    created_at: string
    updated_at: string
  }
  perdas: {
    id: string
    comercio_id: string
    produto_id: string
    variacao_id: string | null
    area: Database["public"]["Enums"]["area_estoque"]
    quantidade: number
    baixado: number
    motivo: string
    observacao: string | null
    funcionario_id: string | null
    registrado_por: string | null
    situacao: string
    operacao_id: string | null
    diferenca_id: string | null
    decidida_em: string | null
    created_at: string
  }
  produto_areas: {
    id: string
    comercio_id: string
    produto_id: string
    variacao_id: string | null
    area: Database["public"]["Enums"]["area_estoque"]
    local_id: string | null
    local_definido_por: string | null
    local_definido_em: string | null
    minimo: number | null
    maximo: number | null
    updated_at: string
  }
  produto_embalagens: {
    id: string
    comercio_id: string
    produto_id: string
    tipo: string
    quantidade: number
    codigo_barras: string | null
    preco_compra: number | null
    removida_em: string | null
    created_at: string
    updated_at: string
  }
  produto_variacoes: {
    id: string
    comercio_id: string
    produto_id: string
    tamanho: string | null
    cor: string | null
    codigo_barras: string | null
    created_at: string
    qtd_informada: number | null
    removida_em: string | null
  }
  produtos: {
    id: string
    comercio_id: string
    fornecedor_id: string | null
    codigo_barras: string | null
    nome: string
    categoria: string | null
    unidade: string
    preco_compra: number
    preco_venda: number
    marca: string | null
    detalhes: Json
    ativo: boolean
    created_at: string
    updated_at: string
    controla_validade: boolean | null
    avisos_dias: number[]
  }
  profiles: {
    id: string
  }
  recebimento_itens: {
    id: string
    recebimento_id: string
    comercio_id: string
    produto_id: string
    variacao_id: string | null
    no_pedido: boolean
    esperado: number | null
    tentativas: Json
    situacao: string
    quantidade_aceita: number | null
    avaria: number
    entrou_estoque: number
    resolvido_por: string | null
    resolvido_em: string | null
    updated_at: string
  }
  recebimentos: {
    id: string
    comercio_id: string
    pedido_id: string | null
    fornecedor_id: string | null
    funcionario_id: string
    situacao: string
    rodada: number
    ultimo_resultado: Json | null
    iniciado_em: string
    concluido_em: string | null
    updated_at: string
  }
  reposicoes: {
    id: string
    comercio_id: string
    produto_id: string
    variacao_id: string | null
    funcionario_id: string
    contado: number
    esperado: number
    sugerido: number
    levado: number | null
    situacao: string
    operacao_id: string | null
    created_at: string
    concluido_em: string | null
  }
  saldos: {
    id: string
    comercio_id: string
    produto_id: string
    variacao_id: string | null
    area: Database["public"]["Enums"]["area_estoque"]
    lote_id: string | null
    pendente: boolean
    pendencia_confirmada: boolean
    origem_id: string | null
    quantidade: number
    updated_at: string
  }
  user_roles: {
    id: string
    user_id: string
    role: Database["public"]["Enums"]["app_role"]
    created_at: string
  }
  venda_itens: {
    id: string
    venda_id: string
    comercio_id: string
    n_item: number
    codigo_pdv: string
    codigo_barras: string | null
    descricao: string
    qtd_nota: number
    unidade_nota: string | null
    valor: number
    produto_id: string | null
    variacao_id: string | null
    embalagem_id: string | null
    qtd_unidades: number | null
    qtd_baixada: number
    qtd_faltou: number
    partes: Json
    situacao: string
    motivo: string | null
    operacao_id: string | null
    resolvido_em: string | null
  }
  vendas: {
    id: string
    comercio_id: string
    caixa_id: string
    chave_nota: string | null
    numero: number | null
    serie: number | null
    emitida_em: string | null
    total: number
    pagamentos: Json
    situacao: string
    cancelada_em: string | null
    recebida_em: string
    origem: string
    nota: Json | null
    turno_id: string | null
    funcionario_id: string | null
    troco: number
    cliente_fiado_id: string | null
    cancelada_por: string | null
    motivo_cancelamento: string | null
  }
}
type FuncoesOperacionais = {
  atualizar_pagamento: { Args: { _pedido: string | null; p: Json | null }; Returns: undefined }
  gerar_codigo_interno: { Args: { _comercio: string | null }; Returns: string }
  pedido_publico: { Args: { _token: string | null }; Returns: Json }
  salvar_cadastro: { Args: { p: Json | null }; Returns: Json }
  cancelar_pedido: { Args: { _pedido: string | null }; Returns: undefined }
  novo_codigo_caixa: { Args: { _id: string | null }; Returns: string }
  desligar_caixa: { Args: { _id: string | null }; Returns: undefined }
  salvar_pedido: { Args: { p: Json | null }; Returns: Json }
  marcar_pedido_enviado: { Args: { _pedido: string | null; _canal: string | null }; Returns: undefined }
  novo_link_pedido: { Args: { _pedido: string | null }; Returns: string }
  responder_pedido: { Args: { _token: string | null; r: Json | null }; Returns: Json }
  criar_funcionario: { Args: { _comercio: string | null; _nome: string | null; _funcao: string | null }; Returns: Json }
  atualizar_funcionario: { Args: { _id: string | null; _nome: string | null; _funcao: string | null }; Returns: undefined }
  conferir_codigo_funcionario: { Args: { _codigo: string | null }; Returns: string }
  entrar_funcionario: { Args: { _codigo: string | null; _pin: string | null; _aparelho: string | null }; Returns: Json }
  bloquear_funcionario: { Args: { _id: string | null; _bloquear: boolean | null }; Returns: Json }
  novo_acesso_funcionario: { Args: { _id: string | null }; Returns: Json }
  sair_funcionario: { Args: { _chave: string | null }; Returns: undefined }
  funcionario_inicio: { Args: { _chave: string | null }; Returns: Json }
  funcionario_conferencia_contar: { Args: { _chave: string | null; _id: string | null; _produto: string | null; _variacao: string | null; _contado: number | null }; Returns: Json }
  explicar_diferenca: { Args: { _id: string | null; _motivo: string | null; _observacao: string | null }; Returns: undefined }
  funcionario_conferencia_lista: { Args: { _chave: string | null }; Returns: Json }
  funcionario_enviar_recebimento: { Args: { _chave: string | null; _id: string | null; _rodada: number | null; _itens: Json | null }; Returns: Json }
  resolver_item_recebimento: { Args: { _item: string | null; _acao: string | null; _tentativa: number | null }; Returns: undefined }
  funcionario_entregas: { Args: { _chave: string | null }; Returns: Json }
  funcionario_abrir_recebimento: { Args: { _chave: string | null; _id: string | null; _pedido: string | null; _fornecedor: string | null }; Returns: Json }
  funcionario_buscar_produto: { Args: { _chave: string | null; _texto: string | null }; Returns: Json }
  conector_enviar_venda: { Args: { _chave: string | null; _nota: Json | null }; Returns: Json }
  funcionario_reposicao_concluir: { Args: { _chave: string | null; _id: string | null; _levado: number | null }; Returns: Json }
  funcionario_reposicao_lista: { Args: { _chave: string | null }; Returns: Json }
  funcionario_desbloquear: { Args: { _chave: string | null; _pin: string | null }; Returns: Json }
  conector_ligar: { Args: { _codigo: string | null; _aparelho: string | null }; Returns: Json }
  conector_cancelar_venda: { Args: { _chave: string | null; _chave_nota: string | null }; Returns: Json }
  criar_caixa: { Args: { _comercio: string | null; _nome: string | null }; Returns: Json }
  renomear_caixa: { Args: { _id: string | null; _nome: string | null }; Returns: undefined }
  conector_estado: { Args: { _chave: string | null }; Returns: Json }
  resolver_item_venda: { Args: { _item: string | null; _acao: string | null; _produto: string | null; _variacao: string | null; _embalagem: string | null }; Returns: Json }
  funcionario_registrar_perda: { Args: { _chave: string | null; _id: string | null; _produto: string | null; _variacao: string | null; _area: string | null; _quantidade: number | null; _motivo: string | null; _observacao: string | null }; Returns: Json }
  definir_limite_faltas: { Args: { _comercio: string | null; _valor: number | null }; Returns: undefined }
  registrar_perda: { Args: { p: Json | null }; Returns: Json }
  funcionario_reposicao_contar: { Args: { _chave: string | null; _id: string | null; _produto: string | null; _variacao: string | null; _contado: number | null }; Returns: Json }
  decidir_perda: { Args: { _id: string | null; _aceitar: boolean | null }; Returns: undefined }
  resolver_conferencia: { Args: { _diferenca: string | null; _contado: number | null }; Returns: Json }
  buscar_catalogo: { Args: { _codigo: string | null }; Returns: Json }
  caixa_estado: { Args: { _chave: string | null }; Returns: Json }
  caixa_produtos: { Args: { _chave: string | null }; Returns: Json }
  caixa_clientes_fiado: { Args: { _chave: string | null }; Returns: Json }
  caixa_abrir: { Args: { _chave: string | null; _id: string | null; _troco: number | null }; Returns: Json }
  caixa_registrar_venda: { Args: { _chave: string | null; _venda: Json | null }; Returns: Json }
  caixa_cancelar_venda: { Args: { _chave: string | null; _venda: string | null; _pin_dono: string | null; _motivo: string | null }; Returns: Json }
  caixa_sangria: { Args: { _chave: string | null; _id: string | null; _turno: string | null; _valor: number | null; _motivo: string | null; _pin_dono: string | null }; Returns: Json }
  caixa_fechar: { Args: { _chave: string | null; _turno: string | null; _contado: number | null; _observacao: string | null }; Returns: Json }
  definir_pin_dono: { Args: { _pin: string | null }; Returns: undefined }
  tem_pin_dono: { Args: Record<string, never>; Returns: boolean }
  definir_caixa_funcionario: { Args: { _id: string | null; _caixa: boolean | null }; Returns: undefined }
  cancelar_venda_celular: { Args: { _venda: string | null; _motivo: string | null }; Returns: Json }
  conferir_fechamento_caixa: { Args: { _turno: string | null }; Returns: undefined }
  salvar_cliente_fiado: { Args: { _id: string | null; _comercio: string | null; _nome: string | null; _telefone: string | null; _ativo: boolean | null }; Returns: undefined }
  receber_fiado: { Args: { _id: string | null; _cliente: string | null; _valor: number | null; _forma: string | null; _observacao: string | null }; Returns: Json }
}
type EnumsOperacionais = {
  app_role: "dono" | "gerente" | "repositor"
  area_estoque: "deposito" | "venda"
  tipo_comercio: "mercado" | "farmacia" | "loja_roupas" | "material_construcao" | "pet_shop" | "autopecas"
  tipo_movimento: "contagem_inicial" | "entrada" | "transferencia" | "ajuste" | "divisao_pendencia" | "venda" | "cancelamento_venda" | "perda"
}
// As tabelas operacionais são só de leitura no navegador; escrita passa pelas RPCs.
type TabelaOperacional<Row> = { Row: Row; Insert: never; Update: never; Relationships: [] }
type BasePublica = DatabaseBase["public"]
type Tabelas = {
  [K in keyof BasePublica["Tables"] | keyof LinhasOperacionais]:
    K extends keyof BasePublica["Tables"]
      ? K extends keyof LinhasOperacionais
        ? Omit<BasePublica["Tables"][K], "Row" | "Insert" | "Update"> & {
            Row: BasePublica["Tables"][K]["Row"] & LinhasOperacionais[K];
            Insert: BasePublica["Tables"][K]["Insert"] & Partial<LinhasOperacionais[K]>;
            Update: BasePublica["Tables"][K]["Update"] & Partial<LinhasOperacionais[K]>;
          }
        : BasePublica["Tables"][K]
      : K extends keyof LinhasOperacionais ? TabelaOperacional<LinhasOperacionais[K]> : never
}
export type Database = Omit<DatabaseBase, "public"> & {
  public: Omit<BasePublica, "Tables" | "Functions" | "Enums"> & {
    Tables: Tabelas;
    Functions: Omit<BasePublica["Functions"], keyof FuncoesOperacionais> & FuncoesOperacionais;
    Enums: Omit<BasePublica["Enums"], keyof EnumsOperacionais> & EnumsOperacionais;
  }
}
