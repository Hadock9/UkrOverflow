#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Генерація DOCX з основними можливостями платформи DevFlow."""

from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt, Cm

OUT = Path(__file__).resolve().parent.parent / "DevFlow-osnovni-mozhlyvosti.docx"


def h(doc, text, level=1):
    return doc.add_heading(text, level=level)


def p(doc, text, bold=False):
    para = doc.add_paragraph()
    run = para.add_run(text)
    run.font.size = Pt(11)
    run.font.name = "Calibri"
    if bold:
        run.bold = True
    return para


def bullet(doc, text):
    para = doc.add_paragraph(text, style="List Bullet")
    for run in para.runs:
        run.font.size = Pt(11)
        run.font.name = "Calibri"


def table_headers(doc, headers, rows):
    t = doc.add_table(rows=1 + len(rows), cols=len(headers))
    t.style = "Table Grid"
    hdr = t.rows[0].cells
    for i, name in enumerate(headers):
        hdr[i].text = name
    for ri, row in enumerate(rows):
        for ci, val in enumerate(row):
            t.rows[ri + 1].cells[ci].text = str(val)
    doc.add_paragraph()


def main():
    doc = Document()
    sec = doc.sections[0]
    sec.top_margin = Cm(2)
    sec.bottom_margin = Cm(2)
    sec.left_margin = Cm(2.5)
    sec.right_margin = Cm(2)

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = title.add_run("DevFlow\n")
    r.bold = True
    r.font.size = Pt(22)
    r2 = title.add_run("Основні можливості веб-платформи\n")
    r2.font.size = Pt(14)
    r3 = title.add_run(f"https://devflow.info · {date.today().strftime('%d.%m.%Y')}")
    r3.font.size = Pt(11)
    doc.add_paragraph()

    h(doc, "1. Про платформу", 1)
    p(doc, (
        "DevFlow — україномовна платформа для розробників. Поєднує Q&A (як Stack Overflow), "
        "knowledge hub (статті, гайди, сніпети, маршрути навчання), тематичні спільноти, "
        "каталог менторів і розробників, стрічку IT-новин та AI-помічника на базі Google Gemini."
    ))

    h(doc, "2. Основні можливості (коротко)", 1)
    highlights = [
        "Knowledge Hub — єдина стрічка контенту: питання, статті, гайди, сніпети, roadmap, best practices, FAQ.",
        "Питання та відповіді — Markdown, голосування, прийнята відповідь, перегляди, пов’язані пости спільнот.",
        "Глобальний пошук — live-підказки в хедері та на сторінках (хаб, новини, теги, спільноти, ментори, розробники).",
        "Каталог тегів — агрегація з усього контенту, хмара тегів, фільтри та посилання на матеріали.",
        "Спільноти — міста, університети, онлайн-групи; пости, коментарі, ролі owner/admin/member.",
        "IT-новини — стрічка в стилі DOU: категорії, коментарі, опитування, sidebar з трендами.",
        "Ментори та розробники — каталоги профілів, редагування профілю ментора.",
        "Профіль користувача — репутація, GitHub OAuth, синхронізація репозиторіїв і стеку.",
        "Сповіщення — відповіді, голоси, коментарі, активність у спільнотах і новинах; bell у хедері.",
        "AI (Gemini) — підказки відповідей, теги, TL;DR, схожі питання, модерація, генерація roadmap.",
        "Realtime — WebSocket для оновлень (питання, відповіді) без перезавантаження сторінки.",
        "Авторизація — email/пароль і GitHub OAuth; ролі user, moderator, admin.",
    ]
    for item in highlights:
        bullet(doc, item)

    h(doc, "3. Розділи сайту", 1)
    routes = [
        ("/", "Головна", "Огляд платформи, превʼю новин і хабу, статистика"),
        ("/hub", "Knowledge Hub", "Уніфікована стрічка, фільтри за типом, сортування, створення контенту"),
        ("/questions, /articles, /guides…", "Типи контенту", "Окремі URL-фільтри тієї ж стрічки хабу"),
        ("/tags", "Теги", "Каталог, пошук, фільтри джерел"),
        ("/search", "Пошук", "Повні результати + live-підказки за областями"),
        ("/news", "Новини", "Стрічка, категорії, коментарі, sidebar"),
        ("/communities", "Спільноти", "Список і сторінки спільнот з постами"),
        ("/mentors", "Ментори", "Каталог і редагування профілю"),
        ("/devs", "Розробники", "Каталог профілів"),
        ("/profile, /users/:id", "Профіль", "Контент автора, GitHub-дані"),
        ("/notifications", "Сповіщення", "Центр подій з фільтрами та посиланнями"),
        ("/login, /register", "Вхід", "Реєстрація та GitHub OAuth"),
    ]
    table_headers(doc, ["URL", "Розділ", "Що робить"], routes)

    h(doc, "4. Knowledge Hub — типи контенту", 1)
    types = [
        ("Питання", "Q&A, відповіді, голоси, accepted answer"),
        ("Стаття", "Довгі матеріали, excerpt, Markdown"),
        ("Гайд", "Короткі інструкції, складність, час читання"),
        ("Сніпет", "Фрагменти коду з мовою програмування"),
        ("Roadmap", "Кроки навчання, складність, тривалість"),
        ("Best practice", "Рекомендації та anti-patterns"),
        ("FAQ", "Пари питання–відповідь"),
        ("Пост спільноти", "Обговорення, pet project, code review тощо"),
    ]
    table_headers(doc, ["Тип", "Можливості"], types)

    h(doc, "5. Пошук", 1)
    bullet(doc, "Live-підказки з 2 символів — у хедері, на /search, новинах, тегах, спільнотах, менторах, каталозі devs")
    bullet(doc, "Області (scope): all, hub, news, tags, communities, mentors, users")
    bullet(doc, "Повнотекстовий глобальний пошук по хабу та постах спільнот (FULLTEXT)")
    bullet(doc, "API: GET /api/search/live, GET /api/search/global")

    h(doc, "6. Спільноти та новини", 1)
    p(doc, "Спільноти:", bold=True)
    bullet(doc, "Створення спільнот і постів, membership, коментарі")
    bullet(doc, "Типи постів: discussion, pet_project, code_review, mentor_search та ін.")
    bullet(doc, "Пов’язаний контент з хабу в постах спільнот")
    p(doc, "Новини:", bold=True)
    bullet(doc, "Категорії: salary, career, tech, community, events, ai")
    bullet(doc, "Коментарі, перегляди, закріплені матеріали")
    bullet(doc, "Sidebar: тренди, зарплати, опитування грейду")

    h(doc, "7. AI-функції (Google Gemini)", 1)
    ai_rows = [
        ("Підказка відповіді", "Чернетка відповіді на питання"),
        ("Автотеги", "Підбір тегів при створенні питання"),
        ("TL;DR", "Коротке резюме довгого питання або дискусії"),
        ("Схожі питання", "Рекомендації перед публікацією"),
        ("Пов’язаний контент", "Статті, гайди, roadmap за темою"),
        ("Модерація", "Перевірка SPAM / токсичності / якості"),
        ("Roadmap generator", "Генерація маршруту навчання за стеком"),
    ]
    table_headers(doc, ["Функція", "Опис"], ai_rows)
    p(doc, "Потрібен GEMINI_API_KEY у змінних середовища сервера.")

    h(doc, "8. Користувачі та сповіщення", 1)
    bullet(doc, "Реєстрація, вхід, GitHub OAuth, ролі moderator/admin")
    bullet(doc, "Репутація, аватар, bio, синхронізація GitHub-профілю")
    bullet(doc, "Сповіщення: відповіді, голоси, коментарі, спільноти, новини, accepted answer")
    bullet(doc, "NotificationBell у хедері, сторінка /notifications з фільтрами")
    bullet(doc, "Закладки на питання")

    h(doc, "9. Технології", 1)
    stack = [
        ("Frontend", "React, Vite, React Router, brutalism UI"),
        ("Backend", "Node.js, Express, JWT, MySQL"),
        ("Realtime", "WebSocket (ws) через nginx"),
        ("AI", "Google Gemini API (Flash / Pro)"),
        ("Deploy", "Docker, nginx, SSL, домен devflow.info"),
    ]
    table_headers(doc, ["Компонент", "Стек"], stack)

    h(doc, "10. Висновок", 1)
    p(doc, (
        "DevFlow — повноцінна платформа для української IT-спільноти: навчання, обмін досвідом, "
        "новини, менторство та AI-підтримка в одному інтерфейсі. Сайт готовий до демонстрації "
        "як дипломний проєкт із production-деплоєм на https://devflow.info."
    ))

    doc.save(str(OUT))
    print(f"Збережено: {OUT}")


if __name__ == "__main__":
    main()
