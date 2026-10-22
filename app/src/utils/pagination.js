/**
 * Utility hàm tính toán phân trang chuẩn cho SQL LIMIT / OFFSET
 * @param {string|number} pageQuery - req.query.page
 * @param {number} limit - Số bản ghi trên 1 trang
 * @param {number} totalItems - Tổng số bản ghi đếm được từ DB
 */
function getPagination(pageQuery, limit = 10, totalItems = 0) {
    const pageNum = parseInt(pageQuery, 10);
    const page = !isNaN(pageNum) && pageNum > 0 ? pageNum : 1;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * limit;

    return {
        page: safePage,
        limit,
        offset,
        totalItems,
        totalPages,
        hasNext: safePage < totalPages,
        hasPrev: safePage > 1,
        nextPage: safePage + 1,
        prevPage: safePage - 1
    };
}

module.exports = {
    getPagination
};

