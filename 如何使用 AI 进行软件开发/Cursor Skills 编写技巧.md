这是一个非常好的切入点。阅读官方的 create-skill 文档后，我为你提炼了编写高质量 Cursor Skill 的5大核心精髓。

  理解这些原则，能让你写出的 Skill 更精准、更节省 Token，且不仅是“能用”，而是“好用”。

  1. 核心哲学：假设 AI 已经很聪明 (Token Economy)
  这是最重要的一点。不要把 Skill 写成“教科书”，要写成“备忘录”。

   * **精髓**：只提供 AI 不知道的上下文。
   * **做法**：
       * ❌ 错误：解释“什么是 PDF”、“Git 是版本控制系统”。（浪费 Token，AI 早就知道这些）
       * ✅ 正确：直接指令“提取文本时使用 pdfplumber 库，不要用 PyPDF2”。
   * **原则**：每句话都要问自己：“这一段值得花费 Token 吗？”、“AI 是不是默认就知道这个？”

  2. 触发机制：Description 是“生死门”
  如果 Description 写得不好，你的 Skill 写得再完美也永远不会被调用。

   * **精髓**：Description 既要写 WHAT（做什么），也要写 WHEN（何时用）。
   * **写法**：
       * 使用第三人称（因为这段话会被注入到 System Prompt 中）。
       * 包含触发关键词。
       * 例子：
           * ❌ "Help you with git." (太模糊)
           * ✅ "Generate descriptive commit messages by analyzing git diffs. Use when the user asks for help writing commit messages or reviewing staged
             changes." (包含具体功能 + 触发场景)

  3. 结构设计：渐进式披露 (Progressive Disclosure)
  不要把所有东西塞进一个 SKILL.md 文件里，尤其是当 Skill 很复杂的时候。

   * **精髓**：主文件轻量化，细节按需读取。
   * **做法**：
       * SKILL.md 控制在 500行以内。
       * 如果是复杂的 API 文档或长篇规范，放在同目录下的 reference.md 或 examples.md 中。
       * 在主文件中引用：“For detailed API usage, read reference.md (reference.md)”。
       * 注意：引用深度不要超过一层（不要让 AI 读了文件A去找文件B，再去找文件C）。

  4. 编写模式：根据任务类型选择“控制粒度”
  不同的任务需要不同形式的指令，文档中总结了三种经典模式：

   * **模式 A：模板模式 (Template Pattern)**
       * 适用：你需要严格的输出格式（如写报告、写 Git Commit）。
       * 做法：直接给出 Markdown 模板，让 AI 填空。
   * **模式 B：举例模式 (Examples Pattern)**
       * 适用：任务比较主观，难以用规则描述（如“写出幽默的代码注释”）。
       * 做法：给出 Input -> Output 的具体案例（Few-Shot Prompting），让 AI 模仿风格。
   * **模式 C：工作流模式 (Workflow Pattern)**
       * 适用：复杂的、多步骤的任务（如“数据库迁移”）。
       * 做法：提供 Checklists，强制 AI 一步步执行并打钩。例如：“1. Analyze schema, 2. Backup data, 3. Execute migration”。

  5. 稳定性：优先使用脚本 (Utility Scripts)
  对于极其脆弱、容错率低的操作，不要指望 AI 每次都生成完美的代码。

   * **精髓：代码比自然语言更可靠。**
   * **做法：**
       * 如果在 Skill 目录下包含了一个 validate.py 或 analyze.sh。
       * 指令就变成：“执行 scripts/validate.py 来检查错误”，而不是“请仔细检查以下规则...”。
       * 这不仅节省 Token（不需要把检查逻辑写在 Prompt 里），而且保证了执行逻辑的绝对一致性。

  ---

  **总结：如何写出“大神级” Skill?**

  当你下次写 Skill 时，按照这个检查清单过一遍：

   1. 描述够准吗？ (包含了具体的触发词和场景？)
   2. 废话删了吗？ (删掉了 AI 本来就懂的常识？)
   3. 例子够好吗？ (与其啰嗦规则，不如给两个完美的 Input/Output 例子)
   4. 太长了吗？ (如果太长，把细节拆分到 reference.md)
   5. 能用脚本吗？ (如果是死板的逻辑，写个脚本让 AI 调用，别让它凭空想)
