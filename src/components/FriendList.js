import React from "react";

function FriendList({
  friends,
  editingIndex,
  editName,
  editLocation,
  setEditName,
  setEditLocation,
  handleSaveEdit,
  handleEditFriend,
  handleRemoveFriend,
  setEditingIndex,
}) {
  return (
    <div className="friends-list">
      {friends.map((f, i) => (
        <div key={i} className={`friend-card ${editingIndex === i ? "editing" : ""}`}>
          <div className="friend-avatar" style={{ background: f.color }}>
            {f.name.charAt(0).toUpperCase()}
          </div>
          {editingIndex === i ? (
            <div className="edit-form">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Name"
                autoFocus
              />
              <input
                type="text"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                placeholder="Location"
                onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(i)}
              />
              <div className="edit-actions">
                <button className="edit-save" onClick={() => handleSaveEdit(i)}>Save</button>
                <button className="edit-cancel" onClick={() => setEditingIndex(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="friend-info">
                <div className="friend-name">{f.name}</div>
                <div className="friend-location-text">{f.location}</div>
              </div>
              <div className="friend-actions">
                <button className="friend-edit" onClick={() => handleEditFriend(i)}>✎</button>
                <button className="friend-remove" onClick={() => handleRemoveFriend(i)}>×</button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default FriendList;
