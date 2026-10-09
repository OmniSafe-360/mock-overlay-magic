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
