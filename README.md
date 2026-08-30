# Santa Lúcia Nutrition Triage

Crie o aplicativo web responsivo “Triagem Nutricional — Hospital Santa Lúcia” a partir deste PRD completo. Implemente o MVP funcional priorizando estrutura Particular/SUS/UTI, alas, salas opcionais, leitos, pacientes, internações, ficha individual, nova triagem, antropometria, condições clínicas, histórico e busca global. Habilite Lovable Cloud primeiro para banco relacional, segurança e arquitetura preparada para autenticação/roles futuros; não exponha dados de pacientes publicamente. Use apenas dados fictícios de demonstração, incluindo Ala 18, Ala B e UTI Adulto e os pacientes fictícios descritos.

Crie a modelagem relacional alinhada ao PRD, com histórico preservado para internações e triagens, e garanta que um leito não tenha duas internações ativas. Desenvolva área administrativa para gerenciar estrutura hospitalar sem excluir registros utilizados. Construa o módulo separado anthropometricCalculations com as funções calculateBMI(), calculateWeightLossPercentage(), calculateWeightChumleaArmKnee(), calculateWeightChumleaComplete() e calculateHeightChumlea(), comentários sobre as fórmulas, cálculo e registro da auditoria de cada estimativa (método, fórmula/protocolo escolhido, medidas/parâmetros, data e profissional). Para pessoas pardas, amarelas ou indígenas, nunca escolha automaticamente equação branca/negra: exija seleção explícita de protocolo ou outro método/não calcular. Mostre sempre a origem de peso/altura e nunca apresente estimados como aferidos.

Faça UX hospitalar limpa, profissional, rápida e tablet-first, em branco, azul, azul-petróleo e verde suave; cards grandes, textos de status explícitos, breadcrumbs clicáveis e ótima responsividade. A tela inicial deve destacar os três tipos de atendimento com métricas; a ala deve ter cards grandes de leitos e estados; a ficha deve conter abas/seções de Resumo, Antropometria, Condições clínicas, Alimentação e mastigação, Triagens e Histórico. A nova triagem deve ter resumo de confirmação antes de salvar. Não implemente ainda classificação/diagnóstico automático de risco ou desnutrição, NRS-2002, MUST ou GLIM, mas deixe o modelo preparado para reavaliações e dashboard futuro.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e4870624-10ec-4607-bbcc-fca612a94607).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
