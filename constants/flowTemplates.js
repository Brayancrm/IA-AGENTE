/**
 * Templates de Fluxo Prontos
 * 
 * Fluxos pré-configurados para diferentes tipos de negócio
 * que o usuário pode usar como base para seu agente.
 */

export const FLOW_TEMPLATES = [
  {
    id: 'ecommerce-simples',
    name: '🛒 E-commerce Simples',
    description: 'Perfeito para lojas online com catálogo de produtos',
    category: 'Vendas',
    estimatedTime: '3-5 min',
    steps: [
      {
        id: Date.now() + '-1',
        type: 'greeting',
        title: 'Cumprimentar Cliente',
        description: 'Seja caloroso e acolhedor. Apresente-se como assistente virtual da loja e pergunte o nome do cliente para personalizar o atendimento.',
        condition: ''
      },
      {
        id: Date.now() + '-2',
        type: 'show_catalog',
        title: 'Apresentar Catálogo',
        description: 'Mostre os produtos disponíveis de forma organizada. Destaque produtos em promoção ou mais vendidos. Permita que o cliente filtre por categoria ou preço.',
        condition: ''
      },
      {
        id: Date.now() + '-3',
        type: 'process_order',
        title: 'Processar Pedido',
        description: 'Confirme os itens escolhidos, quantidades e calcule o total. Pergunte se o cliente quer adicionar mais algum item antes de finalizar.',
        condition: ''
      },
      {
        id: Date.now() + '-4',
        type: 'request_payment',
        title: 'Solicitar Pagamento',
        description: 'Ofereça as formas de pagamento disponíveis (PIX, cartão, boleto). Explique o processo de cada uma e envie os dados necessários.',
        condition: ''
      },
      {
        id: Date.now() + '-5',
        type: 'ask_invoice',
        title: 'Perguntar sobre Nota Fiscal',
        description: 'Pergunte se o cliente deseja nota fiscal. Se sim, colete CPF ou CNPJ para emissão.',
        condition: ''
      },
      {
        id: Date.now() + '-6',
        type: 'collect_address',
        title: 'Coletar Endereço de Entrega',
        description: 'Solicite o endereço completo: rua, número, complemento, bairro, cidade, estado e CEP. Confirme os dados antes de prosseguir.',
        condition: 'Se houver entrega física'
      },
      {
        id: Date.now() + '-7',
        type: 'send_confirmation',
        title: 'Enviar Confirmação',
        description: 'Confirme o pedido com todos os detalhes: itens, valor, forma de pagamento, prazo de entrega. Forneça um número de pedido para rastreamento.',
        condition: ''
      }
    ]
  },
  
  {
    id: 'vendas-consultivas',
    name: '💼 Vendas Consultivas',
    description: 'Para serviços e produtos de alto valor que precisam de qualificação',
    category: 'Vendas',
    estimatedTime: '5-8 min',
    steps: [
      {
        id: Date.now() + '-1',
        type: 'greeting',
        title: 'Cumprimentar e Quebrar o Gelo',
        description: 'Seja cordial e profissional. Agradeça o interesse e pergunte como pode ajudar.',
        condition: ''
      },
      {
        id: Date.now() + '-2',
        type: 'ask_info',
        title: 'Descobrir Necessidade',
        description: 'Faça perguntas abertas para entender o problema ou necessidade do cliente. Escute ativamente e demonstre empatia.',
        condition: ''
      },
      {
        id: Date.now() + '-3',
        type: 'ask_info',
        title: 'Qualificar Lead',
        description: 'Pergunte sobre orçamento, urgência, autoridade de decisão. Isso ajuda a priorizar e personalizar a abordagem.',
        condition: ''
      },
      {
        id: Date.now() + '-4',
        type: 'show_catalog',
        title: 'Apresentar Solução',
        description: 'Com base nas necessidades identificadas, apresente a solução mais adequada. Foque nos benefícios, não só nas características.',
        condition: ''
      },
      {
        id: Date.now() + '-5',
        type: 'custom',
        title: 'Demonstrar Valor',
        description: 'Mostre cases de sucesso, depoimentos ou resultados concretos. Quantifique o ROI quando possível.',
        condition: ''
      },
      {
        id: Date.now() + '-6',
        type: 'custom',
        title: 'Superar Objeções',
        description: 'Pergunte se há alguma dúvida ou preocupação. Responda de forma honesta e mostre como sua solução resolve essas questões.',
        condition: ''
      },
      {
        id: Date.now() + '-7',
        type: 'process_order',
        title: 'Fechar Venda',
        description: 'Se o cliente está pronto, conduza o fechamento. Se não, ofereça um próximo passo (demonstração, proposta, reunião).',
        condition: ''
      },
      {
        id: Date.now() + '-8',
        type: 'send_confirmation',
        title: 'Pós-venda e Próximos Passos',
        description: 'Confirme os detalhes, envie documentos necessários e estabeleça os próximos passos. Agradeça e mantenha o canal aberto.',
        condition: ''
      }
    ]
  },

  {
    id: 'agendamento',
    name: '📅 Agendamento de Serviços',
    description: 'Ideal para consultas, reservas e agendamentos',
    category: 'Serviços',
    estimatedTime: '2-3 min',
    steps: [
      {
        id: Date.now() + '-1',
        type: 'greeting',
        title: 'Cumprimentar Cliente',
        description: 'Seja cordial e pergunte qual serviço o cliente deseja agendar.',
        condition: ''
      },
      {
        id: Date.now() + '-2',
        type: 'show_catalog',
        title: 'Mostrar Serviços Disponíveis',
        description: 'Liste os serviços oferecidos com descrições breves e valores. Ajude o cliente a escolher o mais adequado.',
        condition: ''
      },
      {
        id: Date.now() + '-3',
        type: 'custom',
        title: 'Verificar Disponibilidade',
        description: 'Mostre datas e horários disponíveis. Ofereça pelo menos 3 opções. Pergunte a preferência do cliente.',
        condition: ''
      },
      {
        id: Date.now() + '-4',
        type: 'ask_info',
        title: 'Coletar Informações',
        description: 'Solicite nome completo, telefone e e-mail. Se necessário, pergunte sobre observações especiais ou preparação necessária.',
        condition: ''
      },
      {
        id: Date.now() + '-5',
        type: 'send_confirmation',
        title: 'Confirmar Agendamento',
        description: 'Confirme data, horário, serviço e local. Envie um resumo e explique a política de cancelamento. Ofereça adicionar ao calendário.',
        condition: ''
      },
      {
        id: Date.now() + '-6',
        type: 'custom',
        title: 'Enviar Lembrete',
        description: 'Informe que enviaremos um lembrete 24h antes. Forneça contato para emergências ou reagendamento.',
        condition: ''
      }
    ]
  },

  {
    id: 'suporte-faq',
    name: '❓ Suporte e FAQ',
    description: 'Para atendimento ao cliente e resolução de dúvidas',
    category: 'Suporte',
    estimatedTime: '2-4 min',
    steps: [
      {
        id: Date.now() + '-1',
        type: 'greeting',
        title: 'Cumprimentar e Oferecer Ajuda',
        description: 'Seja empático e pergunte como pode ajudar. Mostre que está pronto para resolver o problema.',
        condition: ''
      },
      {
        id: Date.now() + '-2',
        type: 'ask_info',
        title: 'Identificar o Problema',
        description: 'Faça perguntas para entender o problema. Peça detalhes como número do pedido, produto, ou descrição do erro.',
        condition: ''
      },
      {
        id: Date.now() + '-3',
        type: 'custom',
        title: 'Buscar Solução',
        description: 'Com base no problema, ofereça soluções do FAQ. Se for algo comum, explique o passo a passo da solução.',
        condition: ''
      },
      {
        id: Date.now() + '-4',
        type: 'custom',
        title: 'Resolver ou Escalar',
        description: 'Se resolveu, confirme com o cliente. Se não, informe que vai escalar para um especialista e forneça prazo de retorno.',
        condition: ''
      },
      {
        id: Date.now() + '-5',
        type: 'send_confirmation',
        title: 'Finalizar Atendimento',
        description: 'Agradeça o contato. Pergunte se há mais algo. Envie protocolo de atendimento e mantenha canal aberto.',
        condition: ''
      }
    ]
  },

  {
    id: 'captacao-leads',
    name: '🎯 Captação de Leads',
    description: 'Para capturar informações de potenciais clientes',
    category: 'Marketing',
    estimatedTime: '1-2 min',
    steps: [
      {
        id: Date.now() + '-1',
        type: 'greeting',
        title: 'Cumprimentar e Apresentar Oferta',
        description: 'Seja direto mas amigável. Apresente rapidamente o benefício da oferta (e-book, desconto, trial, etc).',
        condition: ''
      },
      {
        id: Date.now() + '-2',
        type: 'ask_info',
        title: 'Coletar Nome e E-mail',
        description: 'Solicite nome e e-mail. Explique que usará apenas para enviar o material e informações relevantes.',
        condition: ''
      },
      {
        id: Date.now() + '-3',
        type: 'ask_info',
        title: 'Perguntar sobre Interesse',
        description: 'Faça 1-2 perguntas rápidas sobre o interesse ou necessidade. Isso ajuda a segmentar e personalizar o follow-up.',
        condition: ''
      },
      {
        id: Date.now() + '-4',
        type: 'send_confirmation',
        title: 'Enviar Material',
        description: 'Confirme que o material foi enviado por e-mail. Agradeça e mencione que entraremos em contato em breve.',
        condition: ''
      }
    ]
  },

  {
    id: 'restaurante-delivery',
    name: '🍕 Restaurante/Delivery',
    description: 'Para pedidos de comida e delivery',
    category: 'Vendas',
    estimatedTime: '3-4 min',
    steps: [
      {
        id: Date.now() + '-1',
        type: 'greeting',
        title: 'Cumprimentar e Apresentar Cardápio',
        description: 'Seja caloroso e pergunte se o cliente já conhece o cardápio. Destaque pratos especiais do dia.',
        condition: ''
      },
      {
        id: Date.now() + '-2',
        type: 'show_catalog',
        title: 'Mostrar Cardápio',
        description: 'Apresente o cardápio organizado por categorias. Inclua descrições, preços e tempo de preparo.',
        condition: ''
      },
      {
        id: Date.now() + '-3',
        type: 'process_order',
        title: 'Montar Pedido',
        description: 'Confirme cada item, quantidade e observações (sem cebola, ponto da carne, etc). Sugira acompanhamentos ou bebidas.',
        condition: ''
      },
      {
        id: Date.now() + '-4',
        type: 'collect_address',
        title: 'Coletar Endereço',
        description: 'Solicite endereço completo para entrega. Pergunte sobre ponto de referência. Calcule taxa de entrega.',
        condition: 'Se for delivery'
      },
      {
        id: Date.now() + '-5',
        type: 'request_payment',
        title: 'Forma de Pagamento',
        description: 'Pergunte como vai pagar. Se dinheiro, pergunte se precisa de troco. Se cartão, confirme se a maquininha passará.',
        condition: ''
      },
      {
        id: Date.now() + '-6',
        type: 'send_confirmation',
        title: 'Confirmar Pedido',
        description: 'Confirme itens, endereço, forma de pagamento e tempo estimado. Forneça número do pedido para rastreamento.',
        condition: ''
      }
    ]
  }
];

/**
 * Obter template por ID
 */
export function getTemplateById(id) {
  return FLOW_TEMPLATES.find(t => t.id === id);
}

/**
 * Obter templates por categoria
 */
export function getTemplatesByCategory(category) {
  if (category === 'all') return FLOW_TEMPLATES;
  return FLOW_TEMPLATES.filter(t => t.category === category);
}

/**
 * Obter categorias únicas
 */
export function getCategories() {
  return [...new Set(FLOW_TEMPLATES.map(t => t.category))];
}

