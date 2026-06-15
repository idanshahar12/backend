import express from 'express';
import { supabase } from '../config/supabaseClient.js';

const router = express.Router();

// פונקציית עזר להגנה מפני קריסת SQL במקרה של שימוש בגרש (אפוסטרוף) בטקסט
const safeString = (str) => str ? str.replace(/'/g, "''") : '';

// 1. GET ALL POSTS - שליפת כל הפוסטים מהדאטאבייס
router.get('/', async(req, res) => {
    try {
        const { data, error } = await supabase.rpc('execute_sql', { query_text: 'SELECT * FROM posts ORDER BY created_at ASC' });
        if (error) return res.status(400).json({ error: error.message });
        
        console.log("📤 נתוני הפוסטים נשלחו בהצלחה");
        res.json(data);
    } catch (err) {
        console.error("🔥 שגיאה בשליפת כל הפוסטים:", err.message);
        res.status(500).json({ error: "Server error", details: err.message });
    }
});

// 2. CREATE POST - יצירת פוסט חדש (כולל שמירת האימייל של היוצר)
router.post('/create', async (req, res) => {
    console.log("📥 קיבלתי בקשה ליצירת פוסט חדש!", req.body); 
    try {
        const { title, description, img, author, email } = req.body;
        
        const query = `
            INSERT INTO posts ("title", "description", "img", "author", "email")
            VALUES ('${safeString(title)}', '${safeString(description)}', '${safeString(img)}', '${safeString(author)}', '${safeString(email)}')
            RETURNING *
        `;
        
        console.log("🏃 מריץ שאילתת יצירה ב-Supabase...");
        const { data, error } = await supabase.rpc('execute_sql', { query_text: query });
        
        if (error) {
            console.error("🔴 שגיאה מה-RPC ביצירה:", error.message);
            return res.status(400).json({ error: error.message });
        }
        
        const responseData = (data && data.length > 0) ? data[0] : { message: "Success but no data returned" };
        res.json(responseData);
    } catch (err) {
        console.error("🔥 שגיאה פנימית בשרת ביצירת פוסט:", err.message);
        res.status(500).json({ error: "Server crashed", details: err.message });
    }
});

// 3. GET ONE POST BY ID - שליפת פוסט בודד לפי מזהה
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase.rpc('execute_sql', {
            query_text: `SELECT * FROM posts WHERE id = '${id}' LIMIT 1`
        });
        
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        
        if (!data || data.length === 0) {
            return res.status(404).json({ message: 'הפרויקט לא נמצא' });
        }
        
        res.json(data[0]);
    } catch (err) {
        console.error("🔥 שגיאה בשליפת פוסט בודד:", err.message);
        res.status(500).json({ error: "Server error", details: err.message });
    }
});

// 4. DELETE POST BY ID - מחיקת פוסט לפי מזהה והגנת אימייל יוצר
router.delete('/delete/:id', async (req, res) => {
    console.log("🗑️ קיבלתי בקשת מחיקה עבור ID:", req.params.id); 
    try {
        const { id } = req.params;
        const { email } = req.body; // קבלת האימייל של המשתמש שמנסה למחוק

        if (!email) {
            return res.status(401).json({ error: "חסר אימייל לצורך אימות פעולה" });
        }
 
        // המחיקה תתבצע רק אם ה-ID והאימייל של יוצר הפוסט תואמים במדויק
        const query = `
            DELETE FROM posts 
            WHERE id = ${id} AND "email" = '${safeString(email)}'
            RETURNING *
        `;
 
        const { data, error } = await supabase.rpc('execute_sql', { query_text: query });
 
        if (error) {
            console.error("🔴 שגיאה מה-RPC בעת המחיקה:", error.message);
            return res.status(400).json({ error: error.message });
        }
 
        // אם data ריק, סימן שהפוסט לא קיים או שהמשתמש אינו מורשה למחוק אותו
        if (!data || data.length === 0) {
            return res.status(403).json({ message: "אינך מורשה למחוק פוסט זה, או שהפוסט לא נמצא" });
        }
 
        res.json({ message: "Post deleted successfully", deletedPost: data[0] });
    } catch (err) {
        console.error("🔥 שגיאה פנימית בשרת במחיקה:", err.message);
        res.status(500).json({ error: "Server crashed", details: err.message });
    }
});

// 5. EDIT POST BY ID - עדכון פוסט קיים והגנת אימייל יוצר
router.put('/edit/:id', async (req, res) => {
    console.log("📝 קיבלתי בקשת עדכון עבור ID:", req.params.id);
    try {
        const { id } = req.params;
        const { title, description, img, author, email } = req.body;

        if (!email) {
            return res.status(401).json({ error: "חסר אימייל לצורך אימות פעולה" });
        }

        // העדכון יתבצע רק אם האימייל שנשלח תואם לאימייל המקורי שרשום על הפוסט
        const query = `
            UPDATE posts 
            SET "title" = '${safeString(title)}', 
                "description" = '${safeString(description)}', 
                "img" = '${safeString(img)}', 
                "author" = '${safeString(author)}'
            WHERE id = ${id} AND "email" = '${safeString(email)}'
            RETURNING *
        `;

        console.log("🏃 מריץ שאילתת עדכון מאובטחת ב-Supabase...");
        const { data, error } = await supabase.rpc('execute_sql', { query_text: query });

        if (error) {
            console.error("🔴 שגיאה מה-RPC בעת העדכון:", error.message);
            return res.status(400).json({ error: error.message });
        }

        if (!data || data.length === 0) {
            return res.status(403).json({ message: "אינך מורשה לערוך פוסט זה, או שהפוסט לא נמצא" });
        }

        console.log("✨ הפוסט עודכן בהצלחה תחת אימות משתמש!");
        return res.json(data[0]);
    } catch (err) {
        console.error("🔥 שגיאה פנימית בשרת בעדכון:", err.message);
        return res.status(500).json({ error: "Server crashed", details: err.message });
    }
});

export default router;