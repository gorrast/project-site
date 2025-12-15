from pathlib import Path
import sqlite3

# /c:/Users/Hugo/OneDrive - Stargo AB/Hugo/Övrigt/Kod/My_Website/project-site/lib/supabase/modify_data.py

DB_PATH = Path(__file__).parent / "bluebaycup.db"

print("PATH:")
print(DB_PATH)


def get_connection(db_path: Path = DB_PATH) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return sqlite3.connect(str(db_path))


def run_query():
    conn = get_connection()
    try:
        cur = conn.cursor()
        
        # Insert a sample row
        #cur.execute("INSERT INTO dummy (name) VALUES (?)", ("sample",))
        #conn.commit()

        cur.execute("INSERT INTO seasons (year, prize_pool) VALUES (?, ?)", ("2025/2026", 3600))
        #cur.execute("UPDATE seasons SET prize_pool = 1800 WHERE season_id = 2")
        cur.execute("INSERT INTO players (name) VALUES (?)", ('Eric Lagerström'))
        
        # Commit the changes to save them to the database
        conn.commit()

        # Select and print rows
        cur.execute("""
                    SELECT * 
                    FROM players
                    """)
        rows = cur.fetchall()
        for row in rows:
            print(row)
    finally:
        conn.close()


if __name__ == "__main__":
    run_query()