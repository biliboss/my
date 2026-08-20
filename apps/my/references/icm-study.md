# Interpretable Context Methodology — study reference

## Primary source

- **Paper:** Jake Van Clief and David McDermott, “Interpretable Context Methodology: Folder Structure as Agent Architecture,” arXiv:2603.16021v2.
- **HTML v2:** https://arxiv.org/html/2603.16021v2
- **Abstract:** https://arxiv.org/abs/2603.16021v2
- **PDF:** https://arxiv.org/pdf/2603.16021v2
- **Published:** 17 March 2026; v2 updated 18 March 2026 according to the arXiv API.
- **Paper license:** CC BY 4.0 according to the arXiv HTML page.
- **Authors:** Jake Van Clief and David McDermott.
- **Affiliations shown:** Eduba; University of Edinburgh; Palm Coast, Florida, USA.

This file records what the paper says, what it does not prove, and every link exposed by its HTML. It is research input for `my`; it is not evidence that the authors endorse this project.

## The useful idea

ICM replaces framework-level orchestration with filesystem structure for workflows that are **sequential, reviewable, and repeatable**. Numbered folders encode sequence. Markdown contracts encode what each stage reads, does, and writes. Output files become inspectable handoffs and human review gates.

Its five declared principles are:

1. one stage, one job;
2. plain text as the interface;
3. layered context loading;
4. every output is an edit surface;
5. configure the factory, not the product.

The five context layers answer five different questions:

| layer | artifact | question |
|---|---|---|
| 0 | `CLAUDE.md` | Where am I? |
| 1 | workspace `CONTEXT.md` | Where do I go? |
| 2 | stage `CONTEXT.md` | What do I do? |
| 3 | references/configuration | What rules apply? |
| 4 | working artifacts/output | What am I working with? |

## Marketing implications for `my`

- Sell visibility, not “more agents”: every intermediate artifact remains readable and editable.
- Name the fit: sequential, reviewable, repeatable work—not real-time agent swarms.
- Show ownership: the durable state is on the user’s disk in plain files.
- Show the intervention point: a human can stop, edit, rerun, or abandon between stages.
- Lead with source improvement: editing one output fixes one run; improving its source fixes future runs.
- Avoid unsupported efficiency claims. The paper reports promising practice, not controlled superiority.

## Evidence and limitations

The paper reports an invite-only practitioner community of 52 members. Of 33 practitioners using the script-to-animation workspace or similar structures, 30 reported a U-shaped intervention pattern: more edits at direction-setting and final alignment, fewer in middle stages.

The authors explicitly limit that evidence:

- observations came from informal conversations, not instrumented collection;
- the community was invited and self-selected;
- intervention data was self-reported;
- most active use was content production;
- testing used Claude Opus 4.6 and Sonnet 4.6;
- there was no controlled monolithic-prompt comparison;
- cross-model evaluation remains future work.

## Integrity observations

Checked on 20 August 2026:

- The repository URL declared in the paper returned HTTP 404: https://github.com/RinDig/Interpretable-Context-Methodology-ICM-
- The arXiv HTML title says “Agent Architecture”; the Atom API title says “Agentic Architecture.”
- The Atom API summary still calls the protocol “Model Workspace Protocol (MWP),” while HTML v2 calls it “Interpretable Context Methodology (ICM).”
- The paper itself contains no YouTube URL. The videos below were discovered independently and are labeled that way.

## Discovered ecosystem

- Eduba: https://eduba.io/
- Jake Van Clief — “Stop Building AI Agents. Use This Folder System Instead.”: https://www.youtube.com/watch?v=MkN-ss2Nl10
- Columbus AI Tinkerers — “Interpretable Context Methodology”: https://www.youtube.com/watch?v=ac2dC_KpEgk
- RyMac — “Jake Van Clief's ICM Folder System”: https://www.youtube.com/watch?v=tvvaOCK_Z50
- Jamie Lynn — “The ICM Folder Method Cheat Code”: https://www.youtube.com/watch?v=stMW5FBNNwU
- Jamie Lynn — “Using AI ICM Folder System to build my Business site”: https://www.youtube.com/watch?v=xs8q49WhNH4

## Complete bibliography

The 54 bibliography entries below are extracted from the HTML v2. When the paper supplies a URL, it appears inline.

1. (1) M. D. McIlroy, E. N. Pinson, and B. A. Tague, “Unix Time-Sharing System: Foreword,” The Bell System Technical Journal , vol. 57, no. 6, part 2, pp. 1902–1903, 1978.
2. (2) D. M. Ritchie and K. Thompson, “The UNIX Time-Sharing System,” Communications of the ACM , vol. 17, no. 7, pp. 365–375, 1974. DOI: https://doi.org/10.1145/361011.361061 — [1](https://doi.org/10.1145/361011.361061)
3. (3) P. H. Salus, A Quarter Century of Unix . Addison-Wesley, 1994. ISBN: 0-201-54777-5.
4. (4) E. S. Raymond, The Art of Unix Programming . Addison-Wesley Professional, 2003. ISBN: 0-13-142901-9. Available: http://www.catb.org/esr/writings/taoup/html/ — [1](http://www.catb.org/esr/writings/taoup/html/)
5. (5) B. W. Kernighan and R. Pike, The UNIX Programming Environment . Prentice Hall, 1984. ISBN: 0-13-937681-X.
6. (6) M. Shaw and D. Garlan, Software Architecture: Perspectives on an Emerging Discipline . Prentice Hall, 1996. ISBN: 0-13-182957-2.
7. (7) S. I. Feldman, “Make — A Program for Maintaining Computer Programs,” Software: Practice and Experience , vol. 9, no. 4, pp. 255–265, 1979. DOI: https://doi.org/10.1002/spe.4380090402 — [1](https://doi.org/10.1002/spe.4380090402)
8. (8) E. W. Dijkstra, “On the Role of Scientific Thought,” Manuscript EWD447, 1974. Reprinted in Selected Writings on Computing: A Personal Perspective , pp. 60–66. Springer-Verlag, 1982. Available: https://www.cs.utexas.edu/˜EWD/transcriptions/EWD04xx/EWD447.html — [1](https://www.cs.utexas.edu/~EWD/transcriptions/EWD04xx/EWD447.html)
9. (9) D. L. Parnas, “On the Criteria To Be Used in Decomposing Systems into Modules,” Communications of the ACM , vol. 15, no. 12, pp. 1053–1058, 1972. DOI: https://doi.org/10.1145/361598.361623 — [1](https://doi.org/10.1145/361598.361623)
10. (10) D. E. Knuth, “Literate Programming,” The Computer Journal , vol. 27, no. 2, pp. 97–111, 1984. DOI: https://doi.org/10.1093/comjnl/27.2.97 — [1](https://doi.org/10.1093/comjnl/27.2.97)
11. (11) R. P. Gabriel, “The Rise of ‘Worse is Better’,” Originally part of “Lisp: Good News, Bad News, How to Win Big.” AI Expert , vol. 6, no. 6, pp. 33–35, 1991. Available: https://www.dreamsongs.com/WorseIsBetter.html — [1](https://www.dreamsongs.com/WorseIsBetter.html)
12. (12) R. Pike, D. Presotto, S. Dorward, B. Flandrena, K. Thompson, H. Trickey, and P. Winterbottom, “Plan 9 from Bell Labs,” Computing Systems , vol. 8, no. 3, pp. 221–254, 1995. Available: https://css.csail.mit.edu/6.824/2014/papers/plan9.pdf — [1](https://css.csail.mit.edu/6.824/2014/papers/plan9.pdf)
13. (13) S. Chacon and B. Straub, Pro Git , 2nd ed. Apress, 2014. ISBN: 978-1-4842-0076-6. Available: https://git-scm.com/book — [1](https://git-scm.com/book)
14. (14) K. Morris, Infrastructure as Code: Dynamic Systems for the Cloud Age , 2nd ed. O’Reilly Media, 2021. ISBN: 978-1-098-11467-1.
15. (15) J. Humble and D. Farley, Continuous Delivery: Reliable Software Releases through Build, Test, and Deployment Automation . Addison-Wesley Professional, 2010. ISBN: 978-0-321-60191-9.
16. (16) A. Karpathy, “+1 for ‘context engineering’ over ‘prompt engineering’…,” X (formerly Twitter), June 25, 2025. Available: https://x.com/karpathy/status/1937902205765607626 — [1](https://x.com/karpathy/status/1937902205765607626)
17. (17) L. Martin, “Context Engineering,” LangChain Blog, July 2, 2025. Available: https://blog.langchain.com/context-engineering-for-agents/ — [1](https://blog.langchain.com/context-engineering-for-agents/)
18. (18) S. Willison, “Context Engineering,” Simon Willison’s Weblog , June 27, 2025. Available: https://simonwillison.net/2025/jun/27/context-engineering/ — [1](https://simonwillison.net/2025/jun/27/context-engineering/)
19. (19) DAIR.AI, “Context Engineering Guide,” Prompting Guide , 2025. Available: https://www.promptingguide.ai/guides/context-engineering-guide — [1](https://www.promptingguide.ai/guides/context-engineering-guide)
20. (20) Q. Wu, G. Bansal, J. Zhang, Y. Wu, B. Li, E. Zhu, L. Jiang, X. Zhang, S. Zhang, A. Awadallah, R. W. White, D. Burger, and C. Wang, “AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation,” COLM 2024 , arXiv:2308.08155, August 2023. Available: https://arxiv.org/abs/2308.08155 — [1](https://arxiv.org/abs/2308.08155)
21. (21) H. Chase, LangChain [open-source framework]. First released October 2022. Available: https://github.com/langchain-ai/langchain — [1](https://github.com/langchain-ai/langchain)
22. (22) J. S. Park, J. C. O’Brien, C. J. Cai, M. R. Morris, P. Liang, and M. S. Bernstein, “Generative Agents: Interactive Simulacra of Human Behavior,” Proceedings of UIST ’23 . ACM, 2023. DOI: https://doi.org/10.1145/3586183.3606763 — [1](https://doi.org/10.1145/3586183.3606763)
23. (23) Anthropic, “Introducing the Model Context Protocol,” Anthropic Blog, November 25, 2024. Available: https://www.anthropic.com/news/model-context-protocol — [1](https://www.anthropic.com/news/model-context-protocol)
24. (24) A. Jones and C. Kelly, “Code Execution with MCP,” Anthropic Engineering Blog, 2025. Available: https://www.anthropic.com/engineering/code-execution-with-mcp — [1](https://www.anthropic.com/engineering/code-execution-with-mcp)
25. (25) N. F. Liu, K. Lin, J. Hewitt, A. Paranjape, M. Bevilacqua, F. Petroni, and P. Liang, “Lost in the Middle: How Language Models Use Long Contexts,” Transactions of the Association for Computational Linguistics , vol. 12, pp. 157–173, 2024. Available: https://arxiv.org/abs/2307.03172 — [1](https://arxiv.org/abs/2307.03172)
26. (26) T. Wu, M. Terry, and C. J. Cai, “AI Chains: Transparent and Controllable Human-AI Interaction by Chaining Large Language Model Prompts,” CHI Conference on Human Factors in Computing Systems (CHI ’22) . ACM, 2022. DOI: https://doi.org/10.1145/3491102.3517582 — [1](https://doi.org/10.1145/3491102.3517582)
27. (27) J. Wei, X. Wang, D. Schuurmans, M. Bosma, B. Ichter, F. Xia, E. Chi, Q. V. Le, and D. Zhou, “Chain-of-Thought Prompting Elicits Reasoning in Large Language Models,” NeurIPS 2022 . Available: https://arxiv.org/abs/2201.11903 — [1](https://arxiv.org/abs/2201.11903)
28. (28) T. Schick, J. Dwivedi-Yu, R. Dessì, R. Raileanu, M. Lomeli, L. Zettlemoyer, N. Cancedda, and T. Scialom, “Toolformer: Language Models Can Teach Themselves to Use Tools,” NeurIPS 2023 . Available: https://arxiv.org/abs/2302.04761 — [1](https://arxiv.org/abs/2302.04761)
29. (29) S. G. Patil, T. Zhang, X. Wang, and J. E. Gonzalez, “Gorilla: Large Language Model Connected with Massive APIs,” NeurIPS 2024 , arXiv:2305.15334, 2023. Available: https://arxiv.org/abs/2305.15334 — [1](https://arxiv.org/abs/2305.15334)
30. (30) P. Lewis, E. Perez, A. Piktus, F. Petroni, V. Karpukhin, N. Goyal, H. Küttler, M. Lewis, W.-t. Yih, T. Rocktäschel, S. Riedel, and D. Kiela, “Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks,” NeurIPS 2020 , pp. 9459–9474. Available: https://arxiv.org/abs/2005.11401 — [1](https://arxiv.org/abs/2005.11401)
31. (31) H. Jiang, Q. Wu, C.-Y. Lin, Y. Yang, and L. Qiu, “LLMLingua: Compressing Prompts for Accelerated Inference of Large Language Models,” EMNLP 2023 , pp. 13358–13376. DOI: https://doi.org/10.18653/v1/2023.emnlp-main.825 — [1](https://doi.org/10.18653/v1/2023.emnlp-main.825)
32. (32) H. Jiang, Q. Wu, X. Luo, D. Li, C.-Y. Lin, Y. Yang, and L. Qiu, “LongLLMLingua: Accelerating and Enhancing LLMs in Long Context Scenarios via Prompt Compression,” ACL 2024 , pp. 1658–1677. Available: https://arxiv.org/abs/2310.06839 — [1](https://arxiv.org/abs/2310.06839)
33. (33) Addyo, “Context Engineering: Bringing Engineering Discipline to Prompts,” Substack, 2025. Available: https://addyo.substack.com/p/context-engineering-bringing-engineering — [1](https://addyo.substack.com/p/context-engineering-bringing-engineering)
34. (34) S. Amershi, M. Cakmak, W. B. Knox, and T. Kulesza, “Power to the People: The Role of Humans in Interactive Machine Learning,” AI Magazine , vol. 35, no. 4, pp. 105–120, 2014. DOI: https://doi.org/10.1609/aimag.v35i4.2513 — [1](https://doi.org/10.1609/aimag.v35i4.2513)
35. (35) J. A. Fails and D. R. Olsen, Jr., “Interactive Machine Learning,” Proceedings of IUI ’03 , pp. 39–45. ACM, 2003. DOI: https://doi.org/10.1145/604045.604056 — [1](https://doi.org/10.1145/604045.604056)
36. (36) J. J. Dudley and P. O. Kristensson, “A Review of User Interface Design for Interactive Machine Learning,” ACM Transactions on Interactive Intelligent Systems , vol. 8, no. 2, Article 8, pp. 1–37, 2018. DOI: https://doi.org/10.1145/3185517 — [1](https://doi.org/10.1145/3185517)
37. (37) E. Horvitz, “Principles of Mixed-Initiative User Interfaces,” CHI ’99 , pp. 159–166. ACM, 1999. DOI: https://doi.org/10.1145/302979.303030 — [1](https://doi.org/10.1145/302979.303030)
38. (38) M. T. Ribeiro, S. Singh, and C. Guestrin, “‘Why Should I Trust You?’: Explaining the Predictions of Any Classifier,” KDD ’16 , pp. 1135–1144. ACM, 2016. DOI: https://doi.org/10.1145/2939672.2939778 — [1](https://doi.org/10.1145/2939672.2939778)
39. (39) S. M. Lundberg and S.-I. Lee, “A Unified Approach to Interpreting Model Predictions,” NeurIPS 2017 , pp. 4765–4774. Available: https://papers.nips.cc/paper/7062-a-unified-approach-to-interpreting-model-predictions — [1](https://papers.nips.cc/paper/7062-a-unified-approach-to-interpreting-model-predictions)
40. (40) J. D. Lee and K. A. See, “Trust in Automation: Designing for Appropriate Reliance,” Human Factors , vol. 46, no. 1, pp. 50–80, 2004. DOI: https://doi.org/10.1518/hfes.46.1.50_30392 — [1](https://doi.org/10.1518/hfes.46.1.50_30392)
41. (41) R. Parasuraman and V. Riley, “Humans and Automation: Use, Misuse, Disuse, Abuse,” Human Factors , vol. 39, no. 2, pp. 230–253, 1997. DOI: https://doi.org/10.1518/001872097778543886 — [1](https://doi.org/10.1518/001872097778543886)
42. (42) R. Parasuraman, T. B. Sheridan, and C. D. Wickens, “A Model for Types and Levels of Human Interaction with Automation,” IEEE Transactions on Systems, Man, and Cybernetics — Part A , vol. 30, no. 3, pp. 286–297, 2000. DOI: https://doi.org/10.1109/3468.844354 — [1](https://doi.org/10.1109/3468.844354)
43. (43) B. Shneiderman, “Human-Centered Artificial Intelligence: Reliable, Safe & Trustworthy,” International Journal of Human–Computer Interaction , vol. 36, no. 6, pp. 495–504, 2020. DOI: https://doi.org/10.1080/10447318.2020.1741118 — [1](https://doi.org/10.1080/10447318.2020.1741118)
44. (44) B. Shneiderman, Human-Centered AI . Oxford University Press, 2022. ISBN: 978-0192845290.
45. (45) C. Rudin, “Stop Explaining Black Box Machine Learning Models for High Stakes Decisions and Use Interpretable Models Instead,” Nature Machine Intelligence , vol. 1, pp. 206–215, 2019. DOI: https://doi.org/10.1038/s42256-019-0048-x — [1](https://doi.org/10.1038/s42256-019-0048-x)
46. (46) B. Shneiderman, “Direct Manipulation: A Step Beyond Programming Languages,” IEEE Computer , vol. 16, no. 8, pp. 57–69, 1983. DOI: https://doi.org/10.1109/MC.1983.1654471 — [1](https://doi.org/10.1109/MC.1983.1654471)
47. (47) S. Amershi, D. Weld, M. Vorvoreanu, A. Fourney, B. Nushi, P. Collisson, J. Suh, S. Iqbal, P. N. Bennett, K. Inkpen, J. Teevan, R. Kikin-Gil, and E. Horvitz, “Guidelines for Human-AI Interaction,” CHI 2019 , Article 3, pp. 1–13. ACM, 2019. DOI: https://doi.org/10.1145/3290605.3300233 — [1](https://doi.org/10.1145/3290605.3300233)
48. (48) M. Zaharia, A. Chen, A. Davidson, A. Ghodsi, S. A. Hong, A. Konwinski, S. Murching, T. Nykodym, P. Ogilvie, M. Parkhe, F. Xie, and C. Zumar, “Accelerating the Machine Learning Lifecycle with MLflow,” IEEE Data Engineering Bulletin , vol. 41, no. 4, pp. 39–45, 2018. Available: https://people.eecs.berkeley.edu/˜matei/papers/2018/ieee_mlflow.pdf — [1](https://people.eecs.berkeley.edu/~matei/papers/2018/ieee_mlflow.pdf)
49. (49) L. Enqvist, “‘Human Oversight’ in the EU Artificial Intelligence Act,” The Theory and Practice of Legislation , vol. 11, no. 3, 2023. DOI: https://doi.org/10.1080/17579961.2023.2245683 — [1](https://doi.org/10.1080/17579961.2023.2245683)
50. (50) C. Novelli, F. Casolari, A. Rotolo, M. Taddeo, and L. Floridi, “Institutionalised Distrust and Human Oversight of Artificial Intelligence,” Digital Society , vol. 3, no. 8, 2024. Available: https://pmc.ncbi.nlm.nih.gov/articles/PMC11614927/ — [1](https://pmc.ncbi.nlm.nih.gov/articles/PMC11614927/)
51. (51) M. Fink, “Human Oversight under Article 14 of the EU AI Act,” SSRN: 5147196, 2025. Forthcoming in Malgieri et al. (eds.), AI Act Commentary . Hart-Bloomsbury, 2026. DOI: https://doi.org/10.2139/ssrn.5147196 — [1](https://doi.org/10.2139/ssrn.5147196)
52. (52) A. V. Aho, M. S. Lam, R. Sethi, and J. D. Ullman, Compilers: Principles, Techniques, and Tools , 2nd ed. Addison-Wesley, 2006. ISBN: 978-0-321-48681-3.
53. (53) A. Zeller, Why Programs Fail: A Guide to Systematic Debugging , 2nd ed. Morgan Kaufmann, 2009. ISBN: 978-0-12-374515-6.
54. (54) Anthropic, “Introducing Claude Opus 4.6,” https://www.anthropic.com/news/claude-opus-4-6 , February 2026. — [1](https://www.anthropic.com/news/claude-opus-4-6)

## Complete HTML link ledger

The ledger preserves every unique `href` exposed by the HTML v2, including section anchors, arXiv chrome, bibliography links, the email contact, and embedded artifacts. Unsafe `javascript:` and `data:` targets are catalogued in `src/data/icm-links.json` but are deliberately not executable on the website.

1. `arxiv` · [Learn more](https://info.arxiv.org/about) · origin: `paper`
2. `arxiv` · [Back to arXiv](https://arxiv.org/) · origin: `paper`
3. `arxiv` · [Why HTML?](https://info.arxiv.org/about/accessible_HTML.html) · origin: `paper`
4. `sections` · [Report Issue](https://arxiv.org/html/2603.16021v2#) · origin: `paper`
5. `study` · [Back to Abstract](https://arxiv.org/abs/2603.16021v2) · origin: `paper`
6. `study` · [Download PDF](https://arxiv.org/pdf/2603.16021v2) · origin: `paper`
7. `embedded` · `javascript:toggleNavTOC();` (not executable) · origin: `paper`
8. `embedded` · `javascript:toggleReadingMode();` (not executable) · origin: `paper`
9. `sections` · [Abstract.](https://arxiv.org/html/2603.16021v2#abstract1) · origin: `paper`
10. `sections` · [1 Introduction](https://arxiv.org/html/2603.16021v2#S1) · origin: `paper`
11. `sections` · [2 Background and Related Work](https://arxiv.org/html/2603.16021v2#S2) · origin: `paper`
12. `sections` · [2.1 Composability and the Unix Tradition](https://arxiv.org/html/2603.16021v2#S2.SS1) · origin: `paper`
13. `sections` · [2.2 Context Engineering and Agentic AI](https://arxiv.org/html/2603.16021v2#S2.SS2) · origin: `paper`
14. `sections` · [2.3 Human Oversight and Observability](https://arxiv.org/html/2603.16021v2#S2.SS3) · origin: `paper`
15. `sections` · [3 Interpretable Context Methodology](https://arxiv.org/html/2603.16021v2#S3) · origin: `paper`
16. `sections` · [3.1 Design Principles](https://arxiv.org/html/2603.16021v2#S3.SS1) · origin: `paper`
17. `sections` · [3.2 Architecture](https://arxiv.org/html/2603.16021v2#S3.SS2) · origin: `paper`
18. `sections` · [3.3 Stage Contracts and Handoffs](https://arxiv.org/html/2603.16021v2#S3.SS3) · origin: `paper`
19. `sections` · [3.4 Portability and Reproducibility](https://arxiv.org/html/2603.16021v2#S3.SS4) · origin: `paper`
20. `sections` · [4 Working Implementations](https://arxiv.org/html/2603.16021v2#S4) · origin: `paper`
21. `sections` · [4.1 Model and Environment](https://arxiv.org/html/2603.16021v2#S4.SS1) · origin: `paper`
22. `sections` · [4.2 Script-to-Animation Pipeline](https://arxiv.org/html/2603.16021v2#S4.SS2) · origin: `paper`
23. `sections` · [4.3 Course Deck Production](https://arxiv.org/html/2603.16021v2#S4.SS3) · origin: `paper`
24. `sections` · [4.4 Building New Workspaces](https://arxiv.org/html/2603.16021v2#S4.SS4) · origin: `paper`
25. `sections` · [4.5 Early Practitioner Experience](https://arxiv.org/html/2603.16021v2#S4.SS5) · origin: `paper`
26. `sections` · [4.6 Threats to Validity](https://arxiv.org/html/2603.16021v2#S4.SS6) · origin: `paper`
27. `sections` · [5 Discussion](https://arxiv.org/html/2603.16021v2#S5) · origin: `paper`
28. `sections` · [5.1 Where This Works](https://arxiv.org/html/2603.16021v2#S5.SS1) · origin: `paper`
29. `sections` · [5.2 Where This Does Not Work](https://arxiv.org/html/2603.16021v2#S5.SS2) · origin: `paper`
30. `sections` · [5.3 Observability as a Side Effect](https://arxiv.org/html/2603.16021v2#S5.SS3) · origin: `paper`
31. `sections` · [5.4 Implications for Intelligent System Design](https://arxiv.org/html/2603.16021v2#S5.SS4) · origin: `paper`
32. `sections` · [6 Future Directions: Compilation, Debugging, and Source Integrity](https://arxiv.org/html/2603.16021v2#S6) · origin: `paper`
33. `sections` · [6.1 ICM as Multi-Pass Incremental Compilation](https://arxiv.org/html/2603.16021v2#S6.SS1) · origin: `paper`
34. `sections` · [6.2 Toward Semantic Debugging](https://arxiv.org/html/2603.16021v2#S6.SS2) · origin: `paper`
35. `sections` · [6.3 Source Integrity and the Edit-Source Principle](https://arxiv.org/html/2603.16021v2#S6.SS3) · origin: `paper`
36. `sections` · [7 Conclusion](https://arxiv.org/html/2603.16021v2#S7) · origin: `paper`
37. `sections` · [References](https://arxiv.org/html/2603.16021v2#bib) · origin: `paper`
38. `arxiv` · [License: CC BY 4.0](https://info.arxiv.org/help/license/index.html#licenses-available) · origin: `paper`
39. `contact` · [theceo@eduba.io](mailto:theceo@eduba.io) · origin: `paper`
40. `code` · [https://github.com/RinDig/Interpretable-Context-Methodology-ICM-](https://github.com/RinDig/Interpretable-Context-Methodology-ICM-) · origin: `paper`
41. `sections` · [mcilroy1978](https://arxiv.org/html/2603.16021v2#bib.bib1) · origin: `paper`
42. `sections` · [ritchie1974](https://arxiv.org/html/2603.16021v2#bib.bib2) · origin: `paper`
43. `sections` · [kernighan1984](https://arxiv.org/html/2603.16021v2#bib.bib5) · origin: `paper`
44. `sections` · [raymond2003](https://arxiv.org/html/2603.16021v2#bib.bib4) · origin: `paper`
45. `sections` · [shaw1996](https://arxiv.org/html/2603.16021v2#bib.bib6) · origin: `paper`
46. `sections` · [feldman1979](https://arxiv.org/html/2603.16021v2#bib.bib7) · origin: `paper`
47. `sections` · [aho2006](https://arxiv.org/html/2603.16021v2#bib.bib52) · origin: `paper`
48. `sections` · [parnas1972](https://arxiv.org/html/2603.16021v2#bib.bib9) · origin: `paper`
49. `sections` · [dijkstra1974](https://arxiv.org/html/2603.16021v2#bib.bib8) · origin: `paper`
50. `sections` · [karpathy2025](https://arxiv.org/html/2603.16021v2#bib.bib16) · origin: `paper`
51. `sections` · [martin2025](https://arxiv.org/html/2603.16021v2#bib.bib17) · origin: `paper`
52. `sections` · [willison2025](https://arxiv.org/html/2603.16021v2#bib.bib18) · origin: `paper`
53. `sections` · [chase2022](https://arxiv.org/html/2603.16021v2#bib.bib21) · origin: `paper`
54. `sections` · [wu2023autogen](https://arxiv.org/html/2603.16021v2#bib.bib20) · origin: `paper`
55. `sections` · [liu2024](https://arxiv.org/html/2603.16021v2#bib.bib25) · origin: `paper`
56. `sections` · [jiang2023](https://arxiv.org/html/2603.16021v2#bib.bib31) · origin: `paper`
57. `sections` · [anthropic2024mcp](https://arxiv.org/html/2603.16021v2#bib.bib23) · origin: `paper`
58. `sections` · [jones2025](https://arxiv.org/html/2603.16021v2#bib.bib24) · origin: `paper`
59. `sections` · [fails2003](https://arxiv.org/html/2603.16021v2#bib.bib35) · origin: `paper`
60. `sections` · [amershi2014](https://arxiv.org/html/2603.16021v2#bib.bib34) · origin: `paper`
61. `sections` · [dudley2018](https://arxiv.org/html/2603.16021v2#bib.bib36) · origin: `paper`
62. `sections` · [horvitz1999](https://arxiv.org/html/2603.16021v2#bib.bib37) · origin: `paper`
63. `sections` · [parasuraman1997](https://arxiv.org/html/2603.16021v2#bib.bib41) · origin: `paper`
64. `sections` · [lee2004](https://arxiv.org/html/2603.16021v2#bib.bib40) · origin: `paper`
65. `sections` · [parasuraman2000](https://arxiv.org/html/2603.16021v2#bib.bib42) · origin: `paper`
66. `sections` · [shneiderman2020](https://arxiv.org/html/2603.16021v2#bib.bib43) · origin: `paper`
67. `sections` · [shneiderman2022](https://arxiv.org/html/2603.16021v2#bib.bib44) · origin: `paper`
68. `sections` · [rudin2019](https://arxiv.org/html/2603.16021v2#bib.bib45) · origin: `paper`
69. `sections` · [enqvist2023](https://arxiv.org/html/2603.16021v2#bib.bib49) · origin: `paper`
70. `sections` · [novelli2024](https://arxiv.org/html/2603.16021v2#bib.bib50) · origin: `paper`
71. `sections` · [shneiderman1983](https://arxiv.org/html/2603.16021v2#bib.bib46) · origin: `paper`
72. `sections` · [humble2010](https://arxiv.org/html/2603.16021v2#bib.bib15) · origin: `paper`
73. `sections` · [1](https://arxiv.org/html/2603.16021v2#S3.F1) · origin: `paper`
74. `sections` · [2](https://arxiv.org/html/2603.16021v2#S3.F2) · origin: `paper`
75. `sections` · [3](https://arxiv.org/html/2603.16021v2#S3.F3) · origin: `paper`
76. `sections` · [jiang2024](https://arxiv.org/html/2603.16021v2#bib.bib32) · origin: `paper`
77. `sections` · [gabriel1991](https://arxiv.org/html/2603.16021v2#bib.bib11) · origin: `paper`
78. `sections` · [pike1995](https://arxiv.org/html/2603.16021v2#bib.bib12) · origin: `paper`
79. `sections` · [4](https://arxiv.org/html/2603.16021v2#S3.F4) · origin: `paper`
80. `embedded` · `data:` embedded artifact (full value preserved in JSON) · origin: `paper`
81. `sections` · [wu2022chains](https://arxiv.org/html/2603.16021v2#bib.bib26) · origin: `paper`
82. `sections` · [knuth1984](https://arxiv.org/html/2603.16021v2#bib.bib10) · origin: `paper`
83. `sections` · [wei2022](https://arxiv.org/html/2603.16021v2#bib.bib27) · origin: `paper`
84. `sections` · [chacon2014](https://arxiv.org/html/2603.16021v2#bib.bib13) · origin: `paper`
85. `sections` · [morris2021](https://arxiv.org/html/2603.16021v2#bib.bib14) · origin: `paper`
86. `sections` · [anthropic2026opus](https://arxiv.org/html/2603.16021v2#bib.bib54) · origin: `paper`
87. `sections` · [5](https://arxiv.org/html/2603.16021v2#S4.F5) · origin: `paper`
88. `sections` · [amershi2019](https://arxiv.org/html/2603.16021v2#bib.bib47) · origin: `paper`
89. `sections` · [zeller2009](https://arxiv.org/html/2603.16021v2#bib.bib53) · origin: `paper`
90. `research` · [https://doi.org/10.1145/361011.361061](https://doi.org/10.1145/361011.361061) · origin: `paper`
91. `article` · [http://www.catb.org/esr/writings/taoup/html/](http://www.catb.org/esr/writings/taoup/html/) · origin: `paper`
92. `research` · [https://doi.org/10.1002/spe.4380090402](https://doi.org/10.1002/spe.4380090402) · origin: `paper`
93. `article` · [https://www.cs.utexas.edu/˜EWD/transcriptions/EWD04xx/EWD447.html](https://www.cs.utexas.edu/~EWD/transcriptions/EWD04xx/EWD447.html) · origin: `paper`
94. `research` · [https://doi.org/10.1145/361598.361623](https://doi.org/10.1145/361598.361623) · origin: `paper`
95. `research` · [https://doi.org/10.1093/comjnl/27.2.97](https://doi.org/10.1093/comjnl/27.2.97) · origin: `paper`
96. `article` · [https://www.dreamsongs.com/WorseIsBetter.html](https://www.dreamsongs.com/WorseIsBetter.html) · origin: `paper`
97. `article` · [https://css.csail.mit.edu/6.824/2014/papers/plan9.pdf](https://css.csail.mit.edu/6.824/2014/papers/plan9.pdf) · origin: `paper`
98. `code` · [https://git-scm.com/book](https://git-scm.com/book) · origin: `paper`
99. `article` · [https://x.com/karpathy/status/1937902205765607626](https://x.com/karpathy/status/1937902205765607626) · origin: `paper`
100. `article` · [https://blog.langchain.com/context-engineering-for-agents/](https://blog.langchain.com/context-engineering-for-agents/) · origin: `paper`
101. `article` · [https://simonwillison.net/2025/jun/27/context-engineering/](https://simonwillison.net/2025/jun/27/context-engineering/) · origin: `paper`
102. `article` · [https://www.promptingguide.ai/guides/context-engineering-guide](https://www.promptingguide.ai/guides/context-engineering-guide) · origin: `paper`
103. `research` · [https://arxiv.org/abs/2308.08155](https://arxiv.org/abs/2308.08155) · origin: `paper`
104. `code` · [https://github.com/langchain-ai/langchain](https://github.com/langchain-ai/langchain) · origin: `paper`
105. `research` · [https://doi.org/10.1145/3586183.3606763](https://doi.org/10.1145/3586183.3606763) · origin: `paper`
106. `article` · [https://www.anthropic.com/news/model-context-protocol](https://www.anthropic.com/news/model-context-protocol) · origin: `paper`
107. `article` · [https://www.anthropic.com/engineering/code-execution-with-mcp](https://www.anthropic.com/engineering/code-execution-with-mcp) · origin: `paper`
108. `research` · [https://arxiv.org/abs/2307.03172](https://arxiv.org/abs/2307.03172) · origin: `paper`
109. `research` · [https://doi.org/10.1145/3491102.3517582](https://doi.org/10.1145/3491102.3517582) · origin: `paper`
110. `research` · [https://arxiv.org/abs/2201.11903](https://arxiv.org/abs/2201.11903) · origin: `paper`
111. `research` · [https://arxiv.org/abs/2302.04761](https://arxiv.org/abs/2302.04761) · origin: `paper`
112. `research` · [https://arxiv.org/abs/2305.15334](https://arxiv.org/abs/2305.15334) · origin: `paper`
113. `research` · [https://arxiv.org/abs/2005.11401](https://arxiv.org/abs/2005.11401) · origin: `paper`
114. `research` · [https://doi.org/10.18653/v1/2023.emnlp-main.825](https://doi.org/10.18653/v1/2023.emnlp-main.825) · origin: `paper`
115. `research` · [https://arxiv.org/abs/2310.06839](https://arxiv.org/abs/2310.06839) · origin: `paper`
116. `article` · [https://addyo.substack.com/p/context-engineering-bringing-engineering](https://addyo.substack.com/p/context-engineering-bringing-engineering) · origin: `paper`
117. `research` · [https://doi.org/10.1609/aimag.v35i4.2513](https://doi.org/10.1609/aimag.v35i4.2513) · origin: `paper`
118. `research` · [https://doi.org/10.1145/604045.604056](https://doi.org/10.1145/604045.604056) · origin: `paper`
119. `research` · [https://doi.org/10.1145/3185517](https://doi.org/10.1145/3185517) · origin: `paper`
120. `research` · [https://doi.org/10.1145/302979.303030](https://doi.org/10.1145/302979.303030) · origin: `paper`
121. `research` · [https://doi.org/10.1145/2939672.2939778](https://doi.org/10.1145/2939672.2939778) · origin: `paper`
122. `research` · [https://papers.nips.cc/paper/7062-a-unified-approach-to-interpreting-model-predictions](https://papers.nips.cc/paper/7062-a-unified-approach-to-interpreting-model-predictions) · origin: `paper`
123. `research` · [https://doi.org/10.1518/hfes.46.1.50_30392](https://doi.org/10.1518/hfes.46.1.50_30392) · origin: `paper`
124. `research` · [https://doi.org/10.1518/001872097778543886](https://doi.org/10.1518/001872097778543886) · origin: `paper`
125. `research` · [https://doi.org/10.1109/3468.844354](https://doi.org/10.1109/3468.844354) · origin: `paper`
126. `research` · [https://doi.org/10.1080/10447318.2020.1741118](https://doi.org/10.1080/10447318.2020.1741118) · origin: `paper`
127. `research` · [https://doi.org/10.1038/s42256-019-0048-x](https://doi.org/10.1038/s42256-019-0048-x) · origin: `paper`
128. `research` · [https://doi.org/10.1109/MC.1983.1654471](https://doi.org/10.1109/MC.1983.1654471) · origin: `paper`
129. `research` · [https://doi.org/10.1145/3290605.3300233](https://doi.org/10.1145/3290605.3300233) · origin: `paper`
130. `article` · [https://people.eecs.berkeley.edu/˜matei/papers/2018/ieee_mlflow.pdf](https://people.eecs.berkeley.edu/~matei/papers/2018/ieee_mlflow.pdf) · origin: `paper`
131. `research` · [https://doi.org/10.1080/17579961.2023.2245683](https://doi.org/10.1080/17579961.2023.2245683) · origin: `paper`
132. `research` · [https://pmc.ncbi.nlm.nih.gov/articles/PMC11614927/](https://pmc.ncbi.nlm.nih.gov/articles/PMC11614927/) · origin: `paper`
133. `research` · [https://doi.org/10.2139/ssrn.5147196](https://doi.org/10.2139/ssrn.5147196) · origin: `paper`
134. `article` · [https://www.anthropic.com/news/claude-opus-4-6](https://www.anthropic.com/news/claude-opus-4-6) · origin: `paper`
135. `study` · [view the build logs](https://arxiv.org/html/2603.16021v2/__stdout.txt) · origin: `paper`
136. `article` · [L A T E xml](https://math.nist.gov/~BMiller/LaTeXML/) · origin: `paper`
137. `code` · [the following issues](https://github.com/arXiv/html_feedback/issues) · origin: `paper`
138. `code` · [list of packages that need conversion](https://github.com/brucemiller/LaTeXML/wiki/Porting-LaTeX-packages-for-LaTeXML) · origin: `paper`
139. `code` · [developer contributions](https://github.com/brucemiller/LaTeXML/issues) · origin: `paper`
140. `arxiv` · [member institutions](https://info.arxiv.org/about/ourmembers.html) · origin: `paper`
141. `arxiv` · [Help](https://info.arxiv.org/help) · origin: `paper`
142. `arxiv` · [Contact](https://info.arxiv.org/help/contact.html) · origin: `paper`
143. `arxiv` · [Subscribe](https://info.arxiv.org/help/subscribe) · origin: `paper`
144. `arxiv` · [Copyright](https://info.arxiv.org/help/license/index.html) · origin: `paper`
145. `arxiv` · [Privacy](https://info.arxiv.org/help/policies/privacy_policy.html) · origin: `paper`
146. `arxiv` · [Accessibility](https://info.arxiv.org/help/web_accessibility.html) · origin: `paper`
147. `arxiv` · [Operational Status (opens in new tab)](https://status.arxiv.org) · origin: `paper`
148. `article` · [https://www.simonsfoundation.org/](https://www.simonsfoundation.org/) · origin: `paper`
149. `article` · [https://www.sfi.org.bm/](https://www.sfi.org.bm/) · origin: `paper`
150. `article` · [https://www.schmidtsciences.org/](https://www.schmidtsciences.org/) · origin: `paper`
151. `ecosystem` · [Eduba](https://eduba.io/) · origin: `discovery`
152. `video` · [Interpretable Context Methodology – David Hague](https://www.youtube.com/watch?v=ac2dC_KpEgk) · origin: `discovery`
153. `video` · [Youtube Analysis Agent — The ICM Folder Method Cheat Code](https://www.youtube.com/watch?v=stMW5FBNNwU) · origin: `discovery`
154. `video` · [Jake Van Clief's ICM Folder System: The Simple Explanation Nobody Gave You](https://www.youtube.com/watch?v=tvvaOCK_Z50) · origin: `discovery`
155. `video` · [Stop Building AI Agents. Use This Folder System Instead.](https://www.youtube.com/watch?v=MkN-ss2Nl10) · origin: `discovery`
156. `video` · [Using AI ICM Folder System to build my Business site](https://www.youtube.com/watch?v=xs8q49WhNH4) · origin: `discovery`
