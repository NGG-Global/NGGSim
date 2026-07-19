# תכנון ומיגרציות Supabase לפיילוט

סטטוס: קובצי SQL ותיעוד מקומיים בלבד. המיגרציות לא הוחלו על מסד מקומי או מרוחק, הפרויקט לא קושר ל־Supabase ולא נדרשו מפתחות.

## עקרונות התכנון

- כל שש הטבלאות הן פרטיות ומופעל עליהן RLS כבר במיגרציה שיוצרת אותן.
- `anon` אינו מקבל הרשאות טבלה. הגישה הציבורית מוגבלת ל־RPC של `ParticipantSimulationView` ולפעולות session שמחייבות capability אקראי ייעודי לניסיון.
- כל רשומה עסקית נושאת `owner_id` כזהות היוצר לצורכי audit ועקביות. החל ממיגרציה 005 כל אדמין קבוע ומחובר יכול לקרוא ולערוך את סביבת העבודה המשותפת.
- בשלב הנוכחי "אדמין" הוא כל משתמש Supabase Auth קבוע שאינו anonymous. לפני הוספת משתמשים מחוברים בתפקידים אחרים נדרש claim או membership ייעודי ב־RLS.
- מפתחות זרים מורכבים כגון `(simulation_id, owner_id)` מונעים יצירת רשומת ילד השייכת למנחה אחד ומצביעה על סימולציה של מנחה אחר.
- ה־RPC הציבורי בונה JSON חדש לפי allowlist. הוא אינו מחזיר עמודת JSONB מלאה ואינו מסתמך על הסרת שדות לאחר הקריאה.
- כל המיגרציות additive בלבד: אין בהן `drop table`,‏ `truncate`,‏ `delete` או cascade שמוחק נתונים. מחיקה דרך FK מוגדרת `on delete restrict`.
- `publicToken` הוא capability בעל entropy גבוה. ברירת המחדל במסד היא 64 תווים אקראיים, קיימת עליו מגבלת `unique`, ואין עליו `SELECT` אנונימי.

הבחירות תואמות את המלצות Supabase: RLS על טבלאות בסכמה חשופה, `TO authenticated`, שימוש ב־`(select auth.uid())` ואינדקס על עמודת הבעלות. ראו [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security). פונקציית `security definer` מגדירה `search_path = ''` והרשאות הביצוע שלה נשללות לפני grant ממוקד, בהתאם ל־[Database Functions](https://supabase.com/docs/guides/database/functions).

## מודל הנתונים

| טבלה | תפקיד | בעלות וייחודיות |
|---|---|---|
| `profiles` | פרופיל מנחה המקושר ל־`auth.users` | `id = auth.users.id`; מנחה רואה ומעדכן רק את הפרופיל שלו |
| `simulations` | הגדרת סימולציה מלאה, לרבות מידע פנימי | `owner_id`; ייחודיות `(id, owner_id)`; JSONB נבדק כ־object/array |
| `simulation_share_links` | קישורים ציבוריים, סטטוס, תוקף וביטול | `token unique`; קישור פעיל יחיד לסימולציה; FK מורכב לבעלות |
| `participants` | פרטים שהמשתתף מילא ונתוני הסכמה | `owner_id`, `simulation_id`; פרטים מוגדרים כ־PII פרטי |
| `simulation_sessions` | מחזור חיי שיחה, `conversation_id`, תמלול וסטטוס | `conversation_id` ייחודי כאשר קיים; FK מורכב לקישור ולמשתתף |
| `simulation_reports` | סיכום, ציונים, חוזקות, שיפורים ומדדים פנימיים | דוח יחיד לכל `session_id`; FK מורכב ל־session ולבעלות |

ב־`simulations` נשמרים במפורש האובייקטים המלאים: `organization`,‏ `scenario`,‏ `character`,‏ `behavior`,‏ `participant_brief`,‏ `participant_fields`,‏ `facilitator_configuration` ו־`learning_objectives`. מבנה JSONB נבחר כדי לשמור תאימות למודל ה־MVP הקיים; לפני כתיבה מהאפליקציה עדיין נדרשת ולידציית runtime מלאה.

## גבול המידע הציבורי

קריאה ציבורית מתבצעת רק כך:

```ts
const { data, error } = await supabaseClient.rpc('get_participant_simulation', {
  public_token: publicToken,
})
```

כאשר הקישור פעיל, הסימולציה פורסמה ולא חלף התוקף, ה־RPC מחזיר רק:

- `publicToken`
- `title`
- `organizationLabel`, רק אם המנחה אישר הצגת ארגון
- `participantBrief`, עם 11 השדות הציבוריים המוגדרים כיום
- `participantFields`, ורק שדות שהוגדרו `enabled`
- `character`, עם `name` ו־`role` בלבד
- `scenarioSummary`, מתוך התדריך הציבורי

ה־RPC לעולם אינו קורא לתגובה את `scenario.hiddenInfo`, סודות דמות, `behavior`, תנאי הצלחה או כישלון, `facilitator_configuration`, prompts,‏ `learning_objectives`, מדדי דוח, פרטי משתתף או תמלול. token שגוי, מבוטל, שפג תוקפו או שייך לסימולציה שאינה מפורסמת מחזיר `null`.

`security definer` נדרש משום ש־anon חסום מהטבלאות עצמן. הוא מוגן באמצעות `search_path` ריק, שמות טבלאות מפורשים, שאילתה קבועה ללא SQL דינמי, allowlist של שדות, ו־grant רק ל־`anon` ול־`authenticated`. לפני פיילוט ציבורי מומלץ לעטוף את ה־RPC ב־Edge Function לצורך rate limiting, ניטור וניהול abuse; העטיפה אינה רשאית להרחיב את ה־DTO.

## אינדקסים ואילוצים

- אינדקס נפרד על כל `owner_id` המשמש RLS.
- אינדקס על כל `simulation_id` בטבלאות הילדים.
- unique constraint על `simulation_share_links.token`; הוא גם אינדקס חיפוש ה־token.
- unique index חלקי על `simulation_sessions.conversation_id` כאשר הערך אינו `null`.
- אינדקס `created_at desc` בכל טבלה שתוצג כרשימה או תעובד לפי זמן.
- unique constraint על `simulation_reports.session_id` למניעת דוח כפול.
- unique index חלקי שמאפשר קישור `active` יחיד לכל סימולציה. לפני יצירת קישור חדש יש להעביר קישור שפג תוקפו לסטטוס `expired` או לבטל אותו.

## המיגרציות, לפי הסדר

1. `202607190001_create_pilot_tables.sql`
   - יוצר את הטבלאות, constraints, indexes וטריגרי `updated_at`.
   - יוצר profile למשתמש Auth חדש ומוסיף profile חסר למשתמשים קיימים בלי לעדכן profile קיים.
   - מפעיל RLS ושולל הרשאות מ־`anon` ומ־`authenticated`, כך שהמצב בין מיגרציות הוא fail-closed.
2. `202607190002_add_owner_rls_policies.sql`
   - מעניק CRUD ל־`authenticated` בלבד.
   - יוצר מדיניות נפרדת ל־SELECT, INSERT, UPDATE ו־DELETE בכל טבלה.
3. `202607190003_add_public_participant_rpc.sql`
   - יוצר את `get_participant_simulation(text)`.
   - שולל את הרשאת EXECUTE האוטומטית מ־`PUBLIC` ומעניק אותה במפורש ל־`anon` ול־`authenticated`.
4. `202607190004_add_repository_rpcs.sql`
   - מוסיף פעולות אטומיות לפרסום, ביטול פרסום, החלפת token ו־archive רך; פעולות המנחה הן `security invoker` ונשארות כפופות ל־RLS.
   - מוסיף `conversation_state` ו־hash של capability לכל session ציבורי חדש.
   - מוסיף RPC מצומצמים ליצירה, קריאה, עדכון והשלמת session. ה־capability הגולמי מוחזר פעם אחת ואינו נשמר במסד.
5. `202607190005_enable_shared_admin_workspace.sql`
   - מחליף מדיניות SELECT/UPDATE של בעלים בלבד במדיניות משותפת לכל משתמש `authenticated` שאינו anonymous.
   - משאיר יצירת סימולציה חדשה בבעלות היוצר ושומר את `owner_id` בלתי ניתן לשינוי דרך ה־API.
   - מעדכן את פעולות הפרסום האטומיות כך שאדמין יוכל לפרסם, לבטל פרסום, להחליף token או לבצע archive גם לסימולציה שיצר אדמין אחר.

## בדיקות האבטחה

הקובץ `supabase/tests/database/pilot_security.test.sql` מכיל 15 בדיקות pgTAP בתוך transaction שמסתיים ב־rollback:

1. RLS מופעל על כל שש הטבלאות.
2. אדמין א' ואדמין ב' רואים את כל הסימולציות, הקישורים, המשתתפים, ה־sessions והדוחות במרחב המשותף.
3. אדמין אינו יכול ליצור סימולציה חדשה בשם אדמין אחר או לשנות את `owner_id` דרך ה־API.
4. אדמין א' יכול לערוך סימולציה שיצר אדמין ב'; מחיקה קשיחה ישירה נשארת מוגבלת וה־UI משתמש ב־archive רך.
5. משתמש anonymous נשאר חסום גם משום שהוא מקבל את role ‏`authenticated` ב־Anonymous Auth.
6. `anon` מקבל `permission denied` ב־SELECT ישיר על `simulations`.
7. token פעיל מחזיר תצוגה.
8. נבדקות רשימות המפתחות המדויקות ברמה העליונה, בתדריך, בדמות ובשדות המשתתף.
9. ערכי sentinel מתוך hidden info, סודות, תנאים, prompts ומדדים אינם מופיעים בתגובה.
10. token מבוטל או שגוי מחזיר `null`.

Supabase מריץ קובצי SQL תחת `supabase/tests` באמצעות pgTAP והפקודה `supabase test db`; ראו [Testing Your Database](https://supabase.com/docs/guides/database/testing).

## החלה מקומית בטוחה

דרישות מקדימות: Docker-compatible runtime ו־Supabase CLI. הם לא הותקנו במסגרת משימה זו.

```powershell
# התקנה עתידית, רק לאחר אישור
pnpm add --save-dev supabase

# יוצר רק supabase/config.toml; תיקיות migrations/tests הקיימות נשמרות
pnpm exec supabase init

# מפעיל stack מקומי בלבד
pnpm exec supabase start

# מחיל מחדש את כל המיגרציות על המסד המקומי בלבד
pnpm exec supabase db reset --local

# מריץ את בדיקות ה-RLS וה-RPC על המסד המקומי
pnpm exec supabase test db --local

# lint מקומי נוסף
pnpm exec supabase db lint --local --level error
```

`db reset --local` מוחק ומקים מחדש רק את מסד הפיתוח המקומי של ה־CLI. אין להריץ `--linked` במסגרת בדיקה מקומית.

## החלה עתידית על staging — רק לאחר אישור מפורש

1. ליצור פרויקט staging נפרד ולבדוק שאין בו נתוני production.
2. לבצע review ידני לכל חמשת קובצי ה־SQL ולתוצאות הבדיקות המקומיות.
3. לקשר במפורש ל־staging ולוודא את מזהה הפרויקט המוצג:

```powershell
pnpm exec supabase login
pnpm exec supabase link --project-ref <STAGING_PROJECT_REF>
pnpm exec supabase migration list --linked
pnpm exec supabase db push --linked --dry-run
```

4. לשמור את פלט ה־dry run ולאשר את רשימת חמש המיגרציות.
5. רק לאחר אישור נוסף להחלה בפועל:

```powershell
pnpm exec supabase db push --linked
```

אין להריץ `supabase db reset --linked`: הפקודה הרסנית ומוחקת את נתוני המסד המקושר. אין להשתמש ב־`--include-seed` על production. לאחר staging יש להריץ בדיקות אינטגרציה דרך שני משתמשי Auth אמיתיים ו־client אנונימי לפני דיון ב־production.

## פעולות ידניות שעדיין נדרשות

- לאשר שיטת Auth למנחים ולבטל anonymous sign-in או signup לא רצוי בהגדרות הפרויקט.
- לאשר אילו פרטי משתתף נאספים, נוסח הסכמה ותקופות retention לתמלול ולדוחות.
- ליצור staging נפרד, לבחור region ולבחון גיבוי ושחזור.
- להחליט אם token יישמר גולמי כפי שנדרש כרגע, או רק כ־hash במיגרציה עתידית לפני production.
- להוסיף rate limiting ו־abuse monitoring ב־Edge Function לפני חשיפה ציבורית רחבה.
- ליצור types של TypeScript מהסכמה המקומית רק לאחר שהמיגרציות והבדיקות עוברות.
- להגדיר ב־staging את `VITE_DATA_PROVIDER=supabase`; כל אדמין יראה את סביבת העבודה המשותפת ואין fallback אוטומטי לנתוני demo.
- להריץ בדיקת session ציבורי אמיתית ב־staging ולוודא ש־capability שגוי אינו קורא או מעדכן ניסיון.
